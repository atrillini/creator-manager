import { NextResponse } from "next/server";
import { isAdminUser } from "@/lib/admin";
import { createSupabaseClient } from "@/lib/supabase-server";

export async function GET() {
  const supabase = await createSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return NextResponse.json({
    ok: true,
    email: user?.email ?? null,
    isAdmin: isAdminUser(user?.id),
  });
}
