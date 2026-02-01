import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { webSearch, fetchUrl, isDomainAllowed } from "../_shared/webAssist.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { action, query, url, maxResults = 5 } = await req.json();

    if (action === "search") {
      if (!query || typeof query !== "string" || query.trim().length < 3) {
        return new Response(
          JSON.stringify({ ok: false, error: "Query must be at least 3 characters" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const result = await webSearch(query, Math.min(maxResults, 10));
      
      return new Response(
        JSON.stringify(result),
        { status: result.ok ? 200 : 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "fetch") {
      if (!url || typeof url !== "string") {
        return new Response(
          JSON.stringify({ ok: false, error: "URL is required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (!isDomainAllowed(url)) {
        return new Response(
          JSON.stringify({ ok: false, error: "URL domain not in allowlist" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const result = await fetchUrl(url);
      
      return new Response(
        JSON.stringify(result),
        { status: result.ok ? 200 : 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ ok: false, error: "Invalid action. Use 'search' or 'fetch'" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[web-search] Error:", error);
    return new Response(
      JSON.stringify({ ok: false, error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
