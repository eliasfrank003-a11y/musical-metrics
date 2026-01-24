import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// Simple passcode for delete protection
const DELETE_PASSCODE = "Elias";

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { passcode } = await req.json();

    // Verify passcode
    if (passcode !== DELETE_PASSCODE) {
      return new Response(
        JSON.stringify({ error: "Incorrect passcode" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Initialize Supabase client with service role key
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Delete all sessions
    const { error } = await supabase
      .from("practice_sessions")
      .delete()
      .neq("id", 0); // Delete all rows

    if (error) {
      console.error("[delete-all-sessions] Error:", error);
      throw new Error(`Failed to delete sessions: ${error.message}`);
    }

    console.log("[delete-all-sessions] All sessions deleted successfully");

    return new Response(
      JSON.stringify({ success: true, message: "All practice sessions deleted" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[delete-all-sessions] Error:", error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});