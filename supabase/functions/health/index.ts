/**
 * Healthcheck: verifica connessione Supabase, schema (to_regclass), storage.
 * GET o POST; non richiede auth. Ritorna sempre JSON con status 200 (ok) o 503 (unhealthy).
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const ts = new Date().toISOString();
  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

  if (!supabaseUrl || !serviceRoleKey) {
    return json(
      {
        ok: false,
        where: "env",
        code: "ENV_MISSING",
        message: "SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY missing",
        db: false,
        schema: null,
        storage: null,
        ts,
      },
      503
    );
  }

  try {
    const supabase = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });

    // a) DB alive: SELECT 1 via simple query
    let dbOk = false;
    try {
      const { error } = await supabase.from("plan_limits").select("plan_key").limit(1).maybeSingle();
      dbOk = !error;
    } catch {
      dbOk = false;
    }

    if (!dbOk) {
      return json(
        {
          ok: false,
          where: "db",
          code: "DB_UNREACHABLE",
          message: "Database connection failed",
          db: false,
          schema: null,
          storage: null,
          ts,
        },
        503
      );
    }

    // b) Schema: to_regclass via RPC (fallback to table probes if RPC missing)
    let schema: Record<string, boolean> | null = null;
    try {
      const { data, error } = await supabase.rpc("schema_health");
      if (!error && data && typeof data === "object") {
        schema = data as Record<string, boolean>;
      }
    } catch {
      // RPC may not exist: fallback to probing key tables
      const tables = ["pratiche", "documents", "user_roles", "plan_limits", "user_plan", "usage_counters_monthly", "legal_versions", "user_legal_acceptances"];
      schema = {} as Record<string, boolean>;
      for (const t of tables) {
        try {
          const { error } = await supabase.from(t).select("*").limit(0);
          schema[t] = !error;
        } catch {
          schema[t] = false;
        }
      }
    }

    const schemaOk = schema && Object.values(schema).every(Boolean);

    // c) Storage: list buckets, require pratiche-files (Lexora) and/or documents
    let storage: { documents?: boolean; pratiche_files?: boolean } = {};
    let storageOk = false;
    try {
      const { data: buckets, error } = await supabase.storage.listBuckets();
      if (!error && Array.isArray(buckets)) {
        storage.pratiche_files = buckets.some((b) => b.name === "pratiche-files");
        storage.documents = buckets.some((b) => b.name === "documents");
        storageOk = storage.pratiche_files === true || storage.documents === true;
      }
    } catch {
      storageOk = false;
    }

    const overallOk = dbOk && schemaOk && storageOk;
    const where = !dbOk ? "db" : !schemaOk ? "schema" : !storageOk ? "storage" : null;

    if (overallOk) {
      return json(
        {
          ok: true,
          db: true,
          schema,
          storage,
          ts,
        },
        200
      );
    }

    return json(
      {
        ok: false,
        where: where ?? "unknown",
        code: "CHECK_FAILED",
        message: `Health check failed: ${where}`,
        db: dbOk,
        schema,
        storage,
        ts,
      },
      503
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const code = "INTERNAL_ERROR";
    if (typeof console !== "undefined" && console.error) {
      console.error(`[health] ${code}:`, msg);
    }
    return json(
      {
        ok: false,
        where: "exception",
        code,
        message: msg,
        db: false,
        schema: null,
        storage: null,
        ts,
      },
      503
    );
  }
});
