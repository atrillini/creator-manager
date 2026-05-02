import { NextResponse } from "next/server";
import { requireUserId } from "@/lib/supabase-server";
import { canAccessInbox } from "@/lib/inbox-access";

export async function GET() {
  try {
    const userId = await requireUserId();
    return NextResponse.json({ ok: true, canAccess: canAccessInbox(userId) });
  } catch {
    return NextResponse.json({ ok: false, canAccess: false }, { status: 401 });
  }
}
