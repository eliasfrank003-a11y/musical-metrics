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
    const { accessToken, calendarId } = await req.json();

    if (!accessToken) {
      return new Response(
        JSON.stringify({ error: "Missing Google access token" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Default to "ATracker" calendar or use provided calendarId
    const targetCalendarId = calendarId || "primary";

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get the latest started_at from the database
    const { data: latestSession, error: latestError } = await supabase
      .from("practice_sessions")
      .select("started_at")
      .order("started_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (latestError) {
      console.error("Error fetching latest session:", latestError);
      throw new Error("Failed to fetch latest session from database");
    }

    const latestTimestamp = latestSession?.started_at || null;
    console.log(`[sync-google-calendar] Latest timestamp in DB: ${latestTimestamp}`);

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
    
    // Only fetch events after the latest timestamp
    if (latestTimestamp) {
      // Add 1 second to avoid fetching the same event
      const minTime = new Date(new Date(latestTimestamp).getTime() + 1000).toISOString();
      calendarApiUrl.searchParams.set("timeMin", minTime);
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

    // Transform calendar events to practice sessions
    const potentialSessions = events
      .filter((event) => {
        // Must have both start and end times (not all-day events without time)
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

    // Check for duplicates by started_at timestamp
    const startedAtTimestamps = potentialSessions.map(s => s.started_at);
    const { data: existingSessions, error: existingError } = await supabase
      .from("practice_sessions")
      .select("started_at")
      .in("started_at", startedAtTimestamps);

    if (existingError) {
      console.error("Error checking for duplicates:", existingError);
      throw new Error("Failed to check for duplicate sessions");
    }

    const existingTimestamps = new Set(
      (existingSessions || []).map(s => s.started_at)
    );

    // Filter out duplicates
    const newSessions = potentialSessions.filter(
      session => !existingTimestamps.has(session.started_at)
    );

    console.log(`[sync-google-calendar] ${newSessions.length} new sessions after deduplication (${existingTimestamps.size} duplicates skipped)`);

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

    // Get the new latest timestamp
    const { data: newLatest } = await supabase
      .from("practice_sessions")
      .select("started_at")
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
