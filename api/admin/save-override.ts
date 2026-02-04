import type { VercelRequest, VercelResponse } from "@vercel/node";
import { requireAdminNode, HttpError } from "../_lib/requireAdmin.js";
import { supabaseServer } from "../_lib/supabaseServer.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "authorization, content-type");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");

  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ error: "METHOD_NOT_ALLOWED" });

  try {
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return res.status(503).json({ error: "ENV_MISSING" });
    }

    await requireAdminNode(req);

    const body = req.body ?? {};
    const { user_id, plan_override, is_family } = body as any;

    if (!user_id || typeof user_id !== "string") {
      throw new HttpError(400, "INVALID_USER_ID");
    }

    const update: Record<string, any> = {};

    // allow clearing with null if desired
    if ("plan_override" in (body as any)) update.plan_override = plan_override;
    if ("is_family" in (body as any)) update.is_family = is_family;

    if (Object.keys(update).length === 0) {
      throw new HttpError(400, "NO_FIELDS_TO_UPDATE");
    }

    const { error } = await supabaseServer
      .from("profiles")
      .update(update)
      .eq("id", user_id);

    if (error) {
      console.error("ADMIN_SAVE_OVERRIDE_DB_ERROR", error);
      return res.status(500).json({ error: "DB_UPDATE_FAILED" });
    }

    return res.status(200).json({ ok: true, updated: update });
  } catch (e: any) {
    const status = e?.status || 500;
    const msg = e?.message || "SERVER_ERROR";
    return res.status(status).json({ error: msg });
  }
}
