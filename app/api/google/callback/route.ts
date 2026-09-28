import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { google } from "googleapis";
import {
  GOOGLE_CALLBACK_PATH,
  appOrigin,
  createGoogleOAuthClient,
  saveGoogleConnection,
} from "@/lib/google-auth";
import { createSupabaseClient } from "@/lib/supabase-server";

const STATE_COOKIE = "google_oauth_state";

export async function GET(request: Request) {
  const origin = appOrigin(request);
  const params = new URL(request.url).searchParams;
  const cookieStore = await cookies();
  let saved: { state?: string; next?: string } = {};
  try {
    saved = JSON.parse(cookieStore.get(STATE_COOKIE)?.value ?? "{}");
  } catch {
    saved = {};
  }
  const next = saved.next ?? "/dashboard";
  const back = (status: string) => {
    const url = new URL(next, origin);
    url.searchParams.set("google", status);
    const res = NextResponse.redirect(url);
    res.cookies.delete({ name: STATE_COOKIE, path: "/api/google" });
    return res;
  };

  const supabase = await createSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(new URL("/login", origin));

  if (params.get("error")) return back("annullato");
  const code = params.get("code");
  if (!code || !saved.state || params.get("state") !== saved.state) return back("errore");

  try {
    const client = createGoogleOAuthClient(`${origin}${GOOGLE_CALLBACK_PATH}`);
    const { tokens } = await client.getToken(code);
    if (!tokens.refresh_token) return back("senza-token");
    client.setCredentials(tokens);
    const info = await google.oauth2({ version: "v2", auth: client }).userinfo.get().catch(() => null);
    await saveGoogleConnection(user.id, {
      refreshToken: tokens.refresh_token,
      scopes: (tokens.scope ?? "").split(" ").filter(Boolean),
      googleEmail: info?.data.email ?? null,
    });
    return back("collegato");
  } catch (err) {
    console.error("[google callback]", err);
    return back("errore");
  }
}
