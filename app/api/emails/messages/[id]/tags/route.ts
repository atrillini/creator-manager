import { NextResponse } from "next/server";
import { createSupabaseClient, requireUserId } from "@/lib/supabase-server";
import { canAccessInbox } from "@/lib/inbox-access";

function normalizeTagName(input: string) {
  return input.trim().replace(/\s+/g, " ").slice(0, 48);
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  let userId: string;
  try {
    userId = await requireUserId();
  } catch {
    return NextResponse.json({ ok: false, error: "Non autorizzato" }, { status: 401 });
  }
  if (!canAccessInbox(userId)) {
    return NextResponse.json({ ok: false, error: "Accesso Inbox negato" }, { status: 403 });
  }

  const { id: messageId } = await context.params;
  const body = (await request.json().catch(() => ({}))) as { tagName?: string; color?: string | null };
  const tagName = normalizeTagName(String(body.tagName ?? ""));
  if (!tagName) {
    return NextResponse.json({ ok: false, error: "Tag vuoto" }, { status: 400 });
  }

  const supabase = await createSupabaseClient();
  const { data: tag, error: tagError } = await supabase
    .from("email_tags")
    .upsert(
      {
        user_id: userId,
        name: tagName,
        color: body.color ?? null,
      },
      { onConflict: "user_id,name" }
    )
    .select("id, name, color")
    .single();
  if (tagError || !tag) {
    return NextResponse.json(
      { ok: false, error: tagError?.message ?? "Errore salvataggio tag" },
      { status: 400 }
    );
  }

  const { error: linkError } = await supabase.from("email_message_tags").upsert(
    {
      user_id: userId,
      message_id: messageId,
      tag_id: tag.id,
    },
    { onConflict: "message_id,tag_id" }
  );
  if (linkError) {
    return NextResponse.json(
      { ok: false, error: `Errore collegamento tag: ${linkError.message}` },
      { status: 400 }
    );
  }

  return NextResponse.json({ ok: true, tag });
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  let userId: string;
  try {
    userId = await requireUserId();
  } catch {
    return NextResponse.json({ ok: false, error: "Non autorizzato" }, { status: 401 });
  }
  if (!canAccessInbox(userId)) {
    return NextResponse.json({ ok: false, error: "Accesso Inbox negato" }, { status: 403 });
  }
  const { id: messageId } = await context.params;
  const body = (await request.json().catch(() => ({}))) as { tagId?: string };
  const tagId = String(body.tagId ?? "").trim();
  if (!tagId) {
    return NextResponse.json({ ok: false, error: "tagId mancante" }, { status: 400 });
  }

  const supabase = await createSupabaseClient();
  const { error } = await supabase
    .from("email_message_tags")
    .delete()
    .eq("user_id", userId)
    .eq("message_id", messageId)
    .eq("tag_id", tagId);
  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
