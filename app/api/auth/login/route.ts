import { NextResponse } from "next/server";
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
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 401 });
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Errore login";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
