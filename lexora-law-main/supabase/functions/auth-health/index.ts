import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const authHeader = req.headers.get("authorization") ?? req.headers.get("Authorization");
  const startsWithBearer = !!authHeader?.toLowerCase().startsWith("bearer ");

  if (!authHeader) return json({ ok: false, step: "missing_auth_header" }, 401);
  if (!startsWithBearer) return json({ ok: false, step: "not_bearer" }, 401);

  const token = authHeader.replace(/^Bearer\s+/i, "").trim();
  if (token.length < 50) return json({ ok: false, step: "token_malformed" }, 401);

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
  const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? "";

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    return json({ ok: false, step: "missing_supabase_env" }, 500);
  }

  const supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  // CRITICAL: validate token explicitly
  const {
    data: { user },
    error: authError,
  } = await supabaseClient.auth.getUser(token);

  if (authError || !user) {
    return json(
      {
        ok: false,
        step: "getUser_failed",
        msg: authError?.message ?? null,
      },
      401,
    );
  }

  return json({ ok: true, step: "auth_ok", userId: user.id }, 200);
});
