import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

async function isSignupOpen(supabase: SupabaseClient) {
  const allowByEnv = (process.env.AUTH_ALLOW_SIGNUP ?? "true").toLowerCase() === "true";
  if (!allowByEnv) return false;
  const { data } = await supabase
    .from("app_settings")
    .select("signup_enabled")
    .eq("id", "global")
    .maybeSingle<{ signup_enabled: boolean }>();
  if (!data) return true;
  return data.signup_enabled === true;
}

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

    const response = NextResponse.json({ ok: true });
    const cookieStore = await cookies();
    const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(
            ({ name, value, options }: { name: string; value: string; options: CookieOptions }) => {
              cookieStore.set(name, value, options);
              response.cookies.set(name, value, options);
            }
          );
        },
      },
    });

    if (!(await isSignupOpen(supabase))) {
      return NextResponse.json(
        { ok: false, error: "Registrazione disattivata" },
        { status: 403 }
      );
    }

    const { error } = await supabase.auth.signUp({ email, password });
    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
    }
    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Errore registrazione";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
