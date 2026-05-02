import { NextResponse } from "next/server";
import { createSupabaseClient, requireUserId } from "@/lib/supabase-server";
import { canAccessInbox } from "@/lib/inbox-access";

type Row = Record<string, unknown>;

export async function GET(
  _request: Request,
  context: { params: Promise<{ threadKey: string }> }
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
  const { threadKey } = await context.params;
  const supabase = await createSupabaseClient();
  const { data, error } = await supabase
    .from("email_messages")
    .select(
      "id, external_message_id, thread_key, from_name, from_email, to_emails, subject, preview, body_text, body_html, received_at, email_message_tags(tag_id, email_tags(id, name, color))"
    )
    .eq("user_id", userId)
    .eq("thread_key", decodeURIComponent(threadKey))
    .order("received_at", { ascending: false });
  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
  const messages = ((data ?? []) as Row[]).map((row) => {
    const tagLinks = (row.email_message_tags as Row[] | null) ?? [];
    const tags = tagLinks
      .map((link) => link.email_tags as Row | null)
      .filter((tag): tag is Row => !!tag)
      .map((tag) => ({
        id: String(tag.id),
        name: String(tag.name),
        color: tag.color == null ? null : String(tag.color),
      }));
    const fromName = row.from_name == null ? null : String(row.from_name);
    const fromEmail = row.from_email == null ? null : String(row.from_email);
    return {
      id: String(row.id),
      externalMessageId: String(row.external_message_id ?? ""),
      threadKey: String(row.thread_key ?? ""),
      from: fromName || fromEmail || "Mittente sconosciuto",
      fromEmail,
      to: Array.isArray(row.to_emails) ? row.to_emails.map((x) => String(x)) : [],
      subject: String(row.subject ?? "(Senza oggetto)"),
      preview: String(row.preview ?? ""),
      hasBody:
        String(row.body_text ?? "").trim().length > 0 ||
        String(row.body_html ?? "").trim().length > 0,
      date: String(row.received_at ?? new Date().toISOString()),
      tags,
    };
  });
  return NextResponse.json({ ok: true, messages });
}
