import { requireAdmin, HttpError } from "./_lib/requireAdmin";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type",
};

export async function GET(request: Request) {
  try {
    const { user } = await requireAdmin(request);
    return new Response(
      JSON.stringify({ ok: true, email: user.email, message: "Admin access granted" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    if (err instanceof HttpError) {
      return new Response(
        JSON.stringify({ error: err.message }),
        { status: err.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    return new Response(
      JSON.stringify({ error: "INTERNAL_ERROR" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
}
