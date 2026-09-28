import { NextResponse } from "next/server";
import { createSupabaseClient, requireUserId } from "@/lib/supabase-server";
import { canAccessInbox } from "@/lib/inbox-access";

/** Accesso all'inbox + conversazioni da gestire (badge nella navigazione). */
export async function GET() {
  try {
    const userId = await requireUserId();
    const canAccess = canAccessInbox(userId);
    let pending = 0;
    if (canAccess) {
      const supabase = await createSupabaseClient();
      const { count } = await supabase
        .from("email_threads")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .in("status", ["nuova", "da_rispondere"])
        .gt("message_count", 0);
      pending = count ?? 0;
    }
    return NextResponse.json({ ok: true, canAccess, pending });
  } catch {
    return NextResponse.json({ ok: false, canAccess: false, pending: 0 }, { status: 401 });
  }
}
