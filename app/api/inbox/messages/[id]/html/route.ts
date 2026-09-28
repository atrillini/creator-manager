import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/api-auth";
import { canAccessInbox } from "@/lib/inbox-access";
import { isValidUuid } from "@/lib/is-uuid";
import { createSupabaseClient } from "@/lib/supabase-server";

/**
 * HTML originale di un messaggio, da mostrare in un iframe sandbox.
 * La CSP blocca script, form e (di default) le immagini remote, che spesso sono pixel di tracciamento.
 */
export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireApiUser();
  if (!auth.ok) return auth.response;
  if (!canAccessInbox(auth.userId)) {
    return NextResponse.json({ ok: false, error: "Accesso Inbox negato" }, { status: 403 });
  }
  const { id } = await context.params;
  if (!isValidUuid(id)) return NextResponse.json({ ok: false, error: "ID non valido" }, { status: 400 });

  const supabase = await createSupabaseClient();
  const { data } = await supabase
    .from("email_messages")
    .select("body_html")
    .eq("user_id", auth.userId)
    .eq("id", id)
    .maybeSingle();
  if (!data?.body_html) return NextResponse.json({ ok: false, error: "Nessun HTML" }, { status: 404 });

  const images = new URL(request.url).searchParams.get("images") === "1";
  return new NextResponse(String(data.body_html), {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Content-Security-Policy": `default-src 'none'; style-src 'unsafe-inline'; img-src data: ${images ? "https:" : ""}; font-src data:; sandbox`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "no-referrer",
    },
  });
}
