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
  error?: string;
}

// Google Service Account JWT generation
async function getServiceAccountAccessToken(serviceAccountJson: string): Promise<string> {
  const serviceAccount = JSON.parse(serviceAccountJson);
  
  const now = Math.floor(Date.now() / 1000);
  const exp = now + 3600; // 1 hour

  const header = {
    alg: "RS256",
    typ: "JWT",
  };

  const payload = {
    iss: serviceAccount.client_email,
    scope: "https://www.googleapis.com/auth/calendar.readonly",
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: exp,
  };

  // Base64URL encode
  const base64UrlEncode = (obj: object): string => {
    const json = JSON.stringify(obj);
    const base64 = btoa(json);
    return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  };

  const headerEncoded = base64UrlEncode(header);
  const payloadEncoded = base64UrlEncode(payload);
  const unsignedToken = `${headerEncoded}.${payloadEncoded}`;

  // Import the private key and sign
  const privateKeyPem = serviceAccount.private_key;
  const pemContents = privateKeyPem
    .replace(/-----BEGIN PRIVATE KEY-----/, "")
    .replace(/-----END PRIVATE KEY-----/, "")
    .replace(/\n/g, "");
  
  const binaryKey = Uint8Array.from(atob(pemContents), (c) => c.charCodeAt(0));

  const cryptoKey = await crypto.subtle.importKey(
    "pkcs8",
    binaryKey,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    cryptoKey,
    new TextEncoder().encode(unsignedToken)
  );

  const signatureBase64 = btoa(String.fromCharCode(...new Uint8Array(signature)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

  const jwt = `${unsignedToken}.${signatureBase64}`;

  // Exchange JWT for access token
  const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });

  if (!tokenResponse.ok) {
    const errorText = await tokenResponse.text();
    console.error("[sync-calendar] Token exchange failed:", errorText);
    throw new Error(`Failed to get access token: ${tokenResponse.status}`);
  }

  const tokenData = await tokenResponse.json();
  return tokenData.access_token;
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Get service account credentials and calendar ID from secrets
    const serviceAccountJson = Deno.env.get("GOOGLE_SERVICE_ACCOUNT_JSON");
    const calendarId = Deno.env.get("GOOGLE_CALENDAR_ID");

    if (!serviceAccountJson) {
      console.error("[sync-calendar] Missing GOOGLE_SERVICE_ACCOUNT_JSON secret");
      return new Response(
        JSON.stringify({ error: "Server configuration error: Missing service account" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!calendarId) {
      console.error("[sync-calendar] Missing GOOGLE_CALENDAR_ID secret");
      return new Response(
        JSON.stringify({ error: "Server configuration error: Missing calendar ID" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("[sync-calendar] Starting sync with service account...");

    // Get access token using service account
    const accessToken = await getServiceAccountAccessToken(serviceAccountJson);
    console.log("[sync-calendar] Successfully obtained access token");

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get the latest session from the database
    const { data: latestSession, error: latestError } = await supabase
      .from("practice_sessions")
      .select("started_at, duration_seconds")
      .order("started_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (latestError) {
      console.error("[sync-calendar] Error fetching latest session:", latestError);
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
      `[sync-calendar] Latest session: started_at=${latestTimestamp} derived_end=${latestEndTimeMs ? new Date(latestEndTimeMs).toISOString() : null}`
    );

    // Build the Google Calendar API URL
    const calendarApiUrl = new URL(
      `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`
    );
    
    // Only fetch events after the latest end time
    if (latestEndTimeMs) {
      calendarApiUrl.searchParams.set(
        "timeMin",
        new Date(latestEndTimeMs + 1000).toISOString()
      );
    }
    
    calendarApiUrl.searchParams.set("singleEvents", "true");
    calendarApiUrl.searchParams.set("orderBy", "startTime");
    calendarApiUrl.searchParams.set("maxResults", "2500");

    console.log(`[sync-calendar] Fetching events from calendar: ${calendarId}`);

    // Fetch events from Google Calendar
    const eventsResponse = await fetch(calendarApiUrl.toString(), {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!eventsResponse.ok) {
      const errorText = await eventsResponse.text();
      console.error("[sync-calendar] Calendar API error:", errorText);
      throw new Error(`Failed to fetch calendar events: ${eventsResponse.status}`);
    }

    const eventsData = await eventsResponse.json();
    const events: CalendarEvent[] = eventsData.items || [];

    console.log(`[sync-calendar] Found ${events.length} events to process`);

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
      .filter((event) => event.start?.dateTime && event.end?.dateTime)
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

    console.log(`[sync-calendar] ${potentialSessions.length} valid sessions to check`);

    if (potentialSessions.length === 0) {
      return new Response(
        JSON.stringify({
          synced: 0,
          latestTimestamp,
          message: "No valid practice sessions found",
        } as SyncResult),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check for duplicates by started_at
    const startedAtTimestamps = potentialSessions.map(s => s.started_at);
    const { data: existingSessions, error: existingError } = await supabase
      .from("practice_sessions")
      .select("started_at")
      .in("started_at", startedAtTimestamps);

    if (existingError) {
      console.error("[sync-calendar] Error checking duplicates:", existingError);
      throw new Error("Failed to check for duplicate sessions");
    }

    const existingStartMs = new Set(
      (existingSessions || []).map((s) => new Date(s.started_at).getTime())
    );

    const newSessions = potentialSessions.filter((session) => {
      const ms = new Date(session.started_at).getTime();
      return !existingStartMs.has(ms);
    });

    console.log(`[sync-calendar] ${newSessions.length} new sessions after deduplication`);

    if (newSessions.length === 0) {
      return new Response(
        JSON.stringify({
          synced: 0,
          latestTimestamp,
          message: "All events already synced",
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
        console.error("[sync-calendar] Insert error:", insertError);
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

    console.log(`[sync-calendar] Sync complete:`, result);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[sync-calendar] Error:", error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : "Unknown error",
        synced: 0,
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
