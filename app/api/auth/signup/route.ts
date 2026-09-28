import { NextResponse } from "next/server";
import { isSignupAllowedByEnv, isSignupEnabledInUi } from "@/lib/signup-settings";
import { createSupabaseClient } from "@/lib/supabase-server";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      email?: string;
      password?: string;
    };
    const email = String(body.email ?? "").trim();
    const password = String(body.password ?? "");
    if (!email || !password) {
      return NextResponse.json(
        { ok: false, error: "Email e password obbligatorie" },
        { status: 400 }
      );
    }

    const supabase = await createSupabaseClient();
    if (!isSignupAllowedByEnv() || !(await isSignupEnabledInUi(supabase))) {
      return NextResponse.json(
        { ok: false, error: "Registrazione disattivata" },
        { status: 403 }
      );
    }

    const { error } = await supabase.auth.signUp({ email, password });
    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Errore registrazione";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
