import type { VercelRequest, VercelResponse } from "@vercel/node";
import { requireAdminNode } from "./_lib/requireAdmin.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "authorization, content-type");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");

  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "GET") return res.status(405).json({ error: "METHOD_NOT_ALLOWED" });

  try {
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return res.status(503).json({ error: "ENV_MISSING" });
    }

    const { user } = await requireAdminNode(req);
    return res.status(200).json({ ok: true, email: user.email, message: "Admin access granted" });
  } catch (e: any) {
    const status = e?.status || 500;
    const msg = e?.message || "SERVER_ERROR";
    return res.status(status).json({ error: msg });
  }
}
