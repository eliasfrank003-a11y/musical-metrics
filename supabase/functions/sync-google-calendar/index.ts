import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface CalendarEvent {
  id: string;
  summary?: string;
  start: { dateTime?: string; date?: string };
  end: { dateTime?: string; date?: string };
}

interface SyncResult {
  synced: number;
  latestTimestamp: string | null;
  message: string;
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Authenticate the user first
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ error: "Missing authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Create client with user's auth token to verify identity
    const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    // Verify the user by getting their profile
    const { data: { user }, error: userError } = await supabaseAuth.auth.getUser();
    
    if (userError || !user) {
      console.error("[sync-google-calendar] Auth error:", userError);
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const userId = user.id;
    console.log(`[sync-google-calendar] Authenticated user: ${userId}`);

    const { accessToken, calendarId } = await req.json();

    if (!accessToken) {
      return new Response(
        JSON.stringify({ error: "Missing Google access token" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Default to "ATracker" calendar or use provided calendarId
    const targetCalendarId = calendarId || "primary";

    // Use service role client for database operations
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get the latest session from the database for this user
    const { data: latestSession, error: latestError } = await supabase
      .from("practice_sessions")
      .select("started_at, duration_seconds")
      .eq("user_id", userId)
      .order("started_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (latestError) {
      console.error("Error fetching latest session:", latestError);
      throw new Error("Failed to fetch latest session from database");
    }

    const latestTimestamp = latestSession?.started_at || null;
    const latestDurationSeconds = typeof latestSession?.duration_seconds === "number"
      ? latestSession.duration_seconds
      : null;

    const latestEndTimeMs = latestTimestamp && latestDurationSeconds !== null
      ? new Date(latestTimestamp).getTime() + latestDurationSeconds * 1000
      : null;

    console.log(
      `[sync-google-calendar] Latest session in DB: started_at=${latestTimestamp} duration_seconds=${latestDurationSeconds} derived_end=${latestEndTimeMs ? new Date(latestEndTimeMs).toISOString() : null}`
    );

    // First, find the ATracker calendar
    let calendarToUse = targetCalendarId;
    
    if (targetCalendarId === "primary" || targetCalendarId === "ATracker") {
      // List all calendars to find ATracker
      const calendarsResponse = await fetch(
        "https://www.googleapis.com/calendar/v3/users/me/calendarList",
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      );

      if (!calendarsResponse.ok) {
        const errorText = await calendarsResponse.text();
        console.error("Calendar list error:", errorText);
        throw new Error(`Failed to list calendars: ${calendarsResponse.status}`);
      }

      const calendarsData = await calendarsResponse.json();
      const aTrackerCalendar = calendarsData.items?.find(
        (cal: { summary: string; id: string }) => 
          cal.summary?.toLowerCase() === "atracker" || 
          cal.summary?.toLowerCase().includes("atracker")
      );

      if (aTrackerCalendar) {
        calendarToUse = aTrackerCalendar.id;
        console.log(`[sync-google-calendar] Found ATracker calendar: ${calendarToUse}`);
      } else {
        console.log("[sync-google-calendar] ATracker calendar not found, using primary");
        calendarToUse = "primary";
      }
    }

    // Build the Google Calendar API URL
    const calendarApiUrl = new URL(
      `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarToUse)}/events`
    );
    
    // Only fetch events after the latest *end* time.
    if (latestEndTimeMs) {
      calendarApiUrl.searchParams.set(
        "timeMin",
        new Date(latestEndTimeMs + 1000).toISOString()
      );
    }
    
    calendarApiUrl.searchParams.set("singleEvents", "true");
    calendarApiUrl.searchParams.set("orderBy", "startTime");
    calendarApiUrl.searchParams.set("maxResults", "2500");

    console.log(`[sync-google-calendar] Fetching events from: ${calendarApiUrl.toString()}`);

    // Fetch events from Google Calendar
    const eventsResponse = await fetch(calendarApiUrl.toString(), {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!eventsResponse.ok) {
      const errorText = await eventsResponse.text();
      console.error("Calendar API error:", errorText);
      throw new Error(`Failed to fetch calendar events: ${eventsResponse.status}`);
    }

    const eventsData = await eventsResponse.json();
    const events: CalendarEvent[] = eventsData.items || [];

    console.log(`[sync-google-calendar] Found ${events.length} events to process`);

    if (events.length === 0) {
      return new Response(
        JSON.stringify({
          synced: 0,
          latestTimestamp,
          message: "No new events to sync",
        } as SyncResult),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Transform calendar events to practice sessions (include user_id)
    const potentialSessions = events
      .filter((event) => {
        return event.start?.dateTime && event.end?.dateTime;
      })
      .map((event) => {
        const startTime = new Date(event.start.dateTime!);
        const endTime = new Date(event.end.dateTime!);
        const durationSeconds = Math.round((endTime.getTime() - startTime.getTime()) / 1000);

        return {
          started_at: startTime.toISOString(),
          duration_seconds: durationSeconds,
          source: "google_calendar",
          user_id: userId, // Include user_id for RLS
        };
      })
      .filter((session) => session.duration_seconds > 0);

    console.log(`[sync-google-calendar] ${potentialSessions.length} valid sessions to check for duplicates`);

    if (potentialSessions.length === 0) {
      return new Response(
        JSON.stringify({
          synced: 0,
          latestTimestamp,
          message: "No valid practice sessions found in calendar events",
        } as SyncResult),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check for duplicates by started_at for this user
    const startedAtTimestamps = potentialSessions.map(s => s.started_at);
    const { data: existingSessions, error: existingError } = await supabase
      .from("practice_sessions")
      .select("started_at")
      .eq("user_id", userId)
      .in("started_at", startedAtTimestamps);

    if (existingError) {
      console.error("Error checking for duplicates:", existingError);
      throw new Error("Failed to check for duplicate sessions");
    }

    const existingStartMs = new Set(
      (existingSessions || []).map((s) => new Date(s.started_at).getTime())
    );

    // Filter out duplicates
    const newSessions = potentialSessions.filter((session) => {
      const ms = new Date(session.started_at).getTime();
      return !existingStartMs.has(ms);
    });

    const duplicatesSkipped = potentialSessions.length - newSessions.length;
    console.log(
      `[sync-google-calendar] ${newSessions.length} new sessions after deduplication (${duplicatesSkipped} duplicates skipped)`
    );

    if (newSessions.length === 0) {
      return new Response(
        JSON.stringify({
          synced: 0,
          latestTimestamp,
          message: "All events already synced (no new sessions)",
        } as SyncResult),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Insert new sessions in batches
    const batchSize = 100;
    let insertedCount = 0;

    for (let i = 0; i < newSessions.length; i += batchSize) {
      const batch = newSessions.slice(i, i + batchSize);
      const { error: insertError } = await supabase
        .from("practice_sessions")
        .insert(batch);

      if (insertError) {
        console.error("Insert error:", insertError);
        throw new Error(`Failed to insert sessions: ${insertError.message}`);
      }

      insertedCount += batch.length;
    }

    // Get the new latest timestamp for this user
    const { data: newLatest } = await supabase
      .from("practice_sessions")
      .select("started_at")
      .eq("user_id", userId)
      .order("started_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const result: SyncResult = {
      synced: insertedCount,
      latestTimestamp: newLatest?.started_at || latestTimestamp,
      message: `Successfully synced ${insertedCount} new practice sessions`,
    };

    console.log(`[sync-google-calendar] Sync complete:`, result);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[sync-google-calendar] Error:", error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : "Unknown error",
        synced: 0,
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});