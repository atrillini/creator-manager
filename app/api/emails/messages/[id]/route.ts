import { NextResponse } from "next/server";
import { createSupabaseClient, requireUserId } from "@/lib/supabase-server";
import { canAccessInbox } from "@/lib/inbox-access";

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  let userId: string;
  try {
    userId = await requireUserId();
  } catch {
    return NextResponse.json({ ok: false, error: "Non autorizzato" }, { status: 401 });
  }
  if (!canAccessInbox(userId)) {
    return NextResponse.json({ ok: false, error: "Accesso Inbox negato" }, { status: 403 });
  }

  const { id } = await context.params;
  const { searchParams } = new URL(request.url);
  const includeBody = searchParams.get("includeBody") !== "false";
  const supabase = await createSupabaseClient();

  const { data, error } = await supabase
    .from("email_messages")
    .select(
      "id, external_message_id, thread_key, from_name, from_email, to_emails, subject, preview, body_text, body_html, received_at"
    )
    .eq("user_id", userId)
    .eq("id", id)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ ok: false, error: "Messaggio non trovato" }, { status: 404 });
  }

  const fromName = data.from_name == null ? null : String(data.from_name);
  const fromEmail = data.from_email == null ? null : String(data.from_email);
  return NextResponse.json({
    ok: true,
    message: {
      id: String(data.id),
      externalMessageId: String(data.external_message_id ?? ""),
      threadKey: String(data.thread_key ?? ""),
      from: fromName || fromEmail || "Mittente sconosciuto",
      fromEmail,
      to: Array.isArray(data.to_emails) ? data.to_emails.map((x) => String(x)) : [],
      subject: String(data.subject ?? "(Senza oggetto)"),
      preview: String(data.preview ?? ""),
      date: String(data.received_at ?? new Date().toISOString()),
      hasBody:
        String(data.body_text ?? "").trim().length > 0 ||
        String(data.body_html ?? "").trim().length > 0,
      text: includeBody ? String(data.body_text ?? "") : "",
      html: includeBody ? (data.body_html == null ? null : String(data.body_html)) : null,
    },
  });
}
