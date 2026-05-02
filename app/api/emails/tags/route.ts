import { NextResponse } from "next/server";
import { createSupabaseClient, requireUserId } from "@/lib/supabase-server";
import { canAccessInbox } from "@/lib/inbox-access";

export async function GET(request: Request) {
  let userId: string;
  try {
    userId = await requireUserId();
  } catch {
    return NextResponse.json({ ok: false, error: "Non autorizzato" }, { status: 401 });
  }
  if (!canAccessInbox(userId)) {
    return NextResponse.json({ ok: false, error: "Accesso Inbox negato" }, { status: 403 });
  }
  const { searchParams } = new URL(request.url);
  const q = String(searchParams.get("q") ?? "").trim().toLowerCase();
  const supabase = await createSupabaseClient();
  let query = supabase
    .from("email_tags")
    .select("id, name, color")
    .eq("user_id", userId)
    .order("name", { ascending: true })
    .limit(15);
  if (q) {
    query = query.ilike("name", `%${q}%`);
  }
  const { data, error } = await query;
  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true, tags: data ?? [] });
}
