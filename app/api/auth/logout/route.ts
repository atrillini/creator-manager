import { NextResponse } from "next/server";
import { createSupabaseClient } from "@/lib/supabase-server";

export async function POST() {
  const supabase = await createSupabaseClient();
  await supabase.auth.signOut();
  return NextResponse.json({ ok: true });
}
