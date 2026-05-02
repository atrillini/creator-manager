import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

function allowByEnv() {
  return (process.env.AUTH_ALLOW_SIGNUP ?? "true").toLowerCase() === "true";
}

async function getSupabase() {
  const cookieStore = await cookies();
  return createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(
          ({ name, value, options }: { name: string; value: string; options: CookieOptions }) =>
            cookieStore.set(name, value, options)
        );
      },
    },
  });
}

export async function GET() {
  const supabase = await getSupabase();
  const envEnabled = allowByEnv();
  const { data } = await supabase
    .from("app_settings")
    .select("signup_enabled")
    .eq("id", "global")
    .maybeSingle<{ signup_enabled: boolean }>();
  const uiEnabled = data?.signup_enabled ?? true;
  return NextResponse.json({
    ok: true,
    envEnabled,
    uiEnabled,
    effectiveEnabled: envEnabled && uiEnabled,
  });
}

export async function POST(request: Request) {
  const body = (await request.json()) as { enabled?: boolean };
  const enabled = body.enabled === true;
  const supabase = await getSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "Non autorizzato" }, { status: 401 });
  }

  const { error } = await supabase.from("app_settings").upsert(
    {
      id: "global",
      signup_enabled: enabled,
      updated_by: user.id,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "id" }
  );
  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
  }
  return NextResponse.json({ ok: true, enabled });
}
