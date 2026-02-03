/**
 * GET /api/ocr/ping – verify OCR env is loaded and show project_id from credentials.
 * Node runtime only. Do not log credentials.
 */
import type { VercelRequest, VercelResponse } from "@vercel/node";

export const config = { runtime: "nodejs" };

function getCredentials(): { hasKey: boolean; projectIdFromKey: string | null } {
  const raw = process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON;
  if (!raw || typeof raw !== "string" || !raw.trim()) {
    return { hasKey: false, projectIdFromKey: null };
  }
  try {
    const parsed = JSON.parse(raw) as { project_id?: string };
    const projectId =
      typeof parsed?.project_id === "string" ? parsed.project_id : null;
    return { hasKey: true, projectIdFromKey: projectId };
  } catch {
    return { hasKey: false, projectIdFromKey: null };
  }
}

export default function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Content-Type", "application/json");
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }
  const { hasKey, projectIdFromKey } = getCredentials();
  return res.status(200).json({
    ok: true,
    hasKey,
    projectIdFromKey,
  });
}
