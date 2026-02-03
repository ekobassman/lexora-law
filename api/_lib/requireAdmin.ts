import { supabaseServer } from "./supabaseServer";

export class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

function getBearerToken(req: Request) {
  const auth = req.headers.get("authorization") || "";
  const m = auth.match(/^Bearer\s+(.+)$/i);
  return m ? m[1] : null;
}

export async function requireAdmin(req: Request) {
  const token = getBearerToken(req);
  if (!token) throw new HttpError(401, "MISSING_TOKEN");

  const { data, error } = await supabaseServer.auth.getUser(token);
  if (error || !data?.user) throw new HttpError(401, "INVALID_TOKEN");

  const user = data.user;

  const { data: profile, error: profErr } = await supabaseServer
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .single();

  if (profErr) throw new HttpError(403, "PROFILE_NOT_FOUND");
  if (!profile?.is_admin) throw new HttpError(403, "NOT_ADMIN");

  return { user, profile };
}

export async function requireAdminNode(req: any) {
  const auth = req.headers?.authorization || req.headers?.Authorization || "";
  const m = String(auth).match(/^Bearer\s+(.+)$/i);
  const token = m ? m[1] : null;
  if (!token) throw new HttpError(401, "MISSING_TOKEN");

  const { data, error } = await supabaseServer.auth.getUser(token);
  if (error || !data?.user) throw new HttpError(401, "INVALID_TOKEN");
  const user = data.user;

  const { data: prof, error: profErr } = await supabaseServer
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .single();

  if (profErr || !prof) throw new HttpError(403, "PROFILE_NOT_FOUND");
  if (prof.is_admin !== true) throw new HttpError(403, "NOT_ADMIN");

  return { user, profile: prof };
}
