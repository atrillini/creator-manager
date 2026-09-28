import { NextResponse } from "next/server";
import { isAdminUser } from "@/lib/admin";
import { createSupabaseClient } from "@/lib/supabase-server";

type AuthResult = { ok: true; userId: string } | { ok: false; response: NextResponse };

/** Per le route API: utente loggato o risposta 401 pronta da restituire. */
export async function requireApiUser(): Promise<AuthResult> {
  const supabase = await createSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, response: NextResponse.json({ ok: false, error: "Non autorizzato" }, { status: 401 }) };
  }
  return { ok: true, userId: user.id };
}

export async function requireApiAdmin(): Promise<AuthResult> {
  const auth = await requireApiUser();
  if (!auth.ok) return auth;
  if (!isAdminUser(auth.userId)) {
    return { ok: false, response: NextResponse.json({ ok: false, error: "Solo per l'amministratore" }, { status: 403 }) };
  }
  return auth;
}
