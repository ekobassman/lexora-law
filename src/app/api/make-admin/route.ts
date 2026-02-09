import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!  // service role key
);

export async function POST() {
  const userId = "f1116320-e3d4-46a9-9dee-e42301ab5736"; // UID dell'utente admin

  const { data, error } = await supabase.auth.admin.updateUserById(userId, {
    app_metadata: { role: "admin" }
  });

  if (error) {
    console.error(error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, data });
}
