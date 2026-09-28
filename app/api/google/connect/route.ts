import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/api-auth";
import {
  GOOGLE_CALLBACK_PATH,
  GOOGLE_SCOPES,
  appOrigin,
  createGoogleOAuthClient,
} from "@/lib/google-auth";

const STATE_COOKIE = "google_oauth_state";

/** Avvia il consenso Google: al ritorno /api/google/callback salva il refresh token. */
export async function GET(request: Request) {
  const auth = await requireApiUser();
  if (!auth.ok) return auth.response;

  const next = new URL(request.url).searchParams.get("next");
  const safeNext = next && next.startsWith("/") && !next.startsWith("//") ? next : "/dashboard";
  const state = crypto.randomUUID();
  const client = createGoogleOAuthClient(`${appOrigin(request)}${GOOGLE_CALLBACK_PATH}`);
  const url = client.generateAuthUrl({
    access_type: "offline",
    // Forza il rilascio di un nuovo refresh token anche se il consenso esiste già.
    prompt: "consent",
    include_granted_scopes: true,
    scope: GOOGLE_SCOPES,
    state,
  });

  const res = NextResponse.redirect(url);
  res.cookies.set(STATE_COOKIE, JSON.stringify({ state, next: safeNext }), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/api/google",
    maxAge: 600,
  });
  return res;
}
