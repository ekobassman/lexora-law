export const config = { runtime: "nodejs" };

import { requireAdmin, HttpError } from "../_lib/requireAdmin";
import { supabaseServer } from "../_lib/supabaseServer";

export default async function handler(req: Request) {
  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "authorization, content-type",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
      },
    });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "METHOD_NOT_ALLOWED" }), {
      status: 405,
      headers: { "content-type": "application/json" },
    });
  }

  try {
    // 1) ADMIN CHECK (NON BYPASSABILE)
    await requireAdmin(req);

    // 2) PARSE + VALIDATE PAYLOAD
    const body = await req.json();

    const {
      user_id,
      plan_override = null,
      is_family = null,
    } = body ?? {};

    if (!user_id || typeof user_id !== "string") {
      throw new HttpError(400, "INVALID_USER_ID");
    }

    // 3) COSTRUISCI UPDATE DINAMICO
    const update: Record<string, any> = {};
    if (plan_override !== null) update.plan_override = plan_override;
    if (is_family !== null) update.is_family = is_family;

    if (Object.keys(update).length === 0) {
      throw new HttpError(400, "NO_FIELDS_TO_UPDATE");
    }

    // 4) UPDATE DB (SERVICE ROLE)
    const { error } = await supabaseServer
      .from("profiles")
      .update(update)
      .eq("id", user_id);

    if (error) {
      console.error("ADMIN_SAVE_OVERRIDE_DB_ERROR", error);
      throw new HttpError(500, "DB_UPDATE_FAILED");
    }

    // 5) OK
    return new Response(
      JSON.stringify({ ok: true, updated: update }),
      {
        status: 200,
        headers: {
          "content-type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      }
    );

  } catch (e: any) {
    const status = e?.status || 500;
    const msg = e?.message || "SERVER_ERROR";
    return new Response(JSON.stringify({ error: msg }), {
      status,
      headers: {
        "content-type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    });
  }
}
