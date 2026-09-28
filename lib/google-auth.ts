import "server-only";
import { google } from "googleapis";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

export const GOOGLE_SCOPES = [
  "openid",
  "https://www.googleapis.com/auth/userinfo.email",
  "https://www.googleapis.com/auth/youtube.readonly",
  "https://www.googleapis.com/auth/yt-analytics.readonly",
  "https://www.googleapis.com/auth/yt-analytics-monetary.readonly",
];

export const GOOGLE_CALLBACK_PATH = "/api/google/callback";

export class GoogleNotConnectedError extends Error {
  constructor() {
    super("Account Google non collegato: usa «Collega Google» nella dashboard.");
  }
}

function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env ${name}`);
  return v;
}

export function createGoogleOAuthClient(redirectUri?: string) {
  return new google.auth.OAuth2(required("GOOGLE_CLIENT_ID"), required("GOOGLE_CLIENT_SECRET"), redirectUri);
}

/** Origine pubblica dell'app (per il redirect URI registrato su Google). */
export function appOrigin(request: Request) {
  const fromEnv = process.env.APP_URL?.trim().replace(/\/$/, "");
  return fromEnv || new URL(request.url).origin;
}

/**
 * App OAuth in modalità "Testing": Google fa scadere il refresh token dopo 7 giorni.
 * GOOGLE_TOKEN_TTL_DAYS=0 se l'app viene pubblicata (token senza scadenza).
 */
function tokenTtlDays() {
  const raw = process.env.GOOGLE_TOKEN_TTL_DAYS?.trim();
  const n = raw === undefined || raw === "" ? 7 : Number(raw);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

/** Sotto questa soglia l'app mostra l'avviso di rinnovo. */
const RENEW_WARNING_MS = 2 * 86_400_000;

export type GoogleConnectionStatus = {
  connected: boolean;
  /** Collegamento tramite env GOOGLE_REFRESH_TOKEN (metodo vecchio). */
  legacyEnv: boolean;
  googleEmail: string | null;
  lastSyncAt: string | null;
  /** Il token non è più valido: serve ricollegare. */
  needsReconnect: boolean;
  lastError: string | null;
  /** Scadenza stimata del token (solo modalità Testing). */
  expiresAt: string | null;
  /** Scaduto o in scadenza entro 2 giorni: va rinnovato. */
  renewSoon: boolean;
};

type ConnectionRow = {
  refresh_token: string;
  connected_at: string;
  google_email: string | null;
  last_sync_at: string | null;
  last_error: string | null;
};

async function loadConnection(userId: string): Promise<ConnectionRow | null> {
  const admin = createSupabaseAdminClient();
  const { data } = await admin
    .from("google_connections")
    .select("refresh_token, connected_at, google_email, last_sync_at, last_error")
    .eq("user_id", userId)
    .maybeSingle<ConnectionRow>();
  return data ?? null;
}

export async function getGoogleConnectionStatus(userId: string): Promise<GoogleConnectionStatus> {
  const row = await loadConnection(userId).catch(() => null);
  const legacyEnv = !row && Boolean(process.env.GOOGLE_REFRESH_TOKEN);
  const ttl = tokenTtlDays();
  const expiresAtMs = row && ttl ? new Date(row.connected_at).getTime() + ttl * 86_400_000 : null;
  const needsReconnect = row?.last_error === "invalid_grant";
  return {
    connected: Boolean(row) || legacyEnv,
    legacyEnv,
    googleEmail: row?.google_email ?? null,
    lastSyncAt: row?.last_sync_at ?? null,
    needsReconnect,
    lastError: row?.last_error ?? null,
    expiresAt: expiresAtMs ? new Date(expiresAtMs).toISOString() : null,
    renewSoon: needsReconnect || (expiresAtMs != null && expiresAtMs - Date.now() < RENEW_WARNING_MS),
  };
}

export async function saveGoogleConnection(
  userId: string,
  data: { refreshToken: string; scopes: string[]; googleEmail: string | null }
) {
  const admin = createSupabaseAdminClient();
  const now = new Date().toISOString();
  const { error } = await admin.from("google_connections").upsert(
    {
      user_id: userId,
      refresh_token: data.refreshToken,
      scopes: data.scopes,
      google_email: data.googleEmail,
      connected_at: now,
      updated_at: now,
      last_error: null,
      last_error_at: null,
    },
    { onConflict: "user_id" }
  );
  if (error) throw new Error(error.message);
}

export async function recordGoogleSyncResult(userId: string, error: unknown | null) {
  const admin = createSupabaseAdminClient();
  const now = new Date().toISOString();
  await admin
    .from("google_connections")
    .update(
      error
        ? { last_error: isInvalidGrant(error) ? "invalid_grant" : errorMessage(error).slice(0, 500), last_error_at: now }
        : { last_sync_at: now, last_error: null, last_error_at: null }
    )
    .eq("user_id", userId);
}

export async function disconnectGoogle(userId: string) {
  const admin = createSupabaseAdminClient();
  const row = await loadConnection(userId);
  if (row) {
    await createGoogleOAuthClient()
      .revokeToken(row.refresh_token)
      .catch(() => undefined);
  }
  await admin.from("google_connections").delete().eq("user_id", userId);
}

function errorMessage(err: unknown) {
  return err instanceof Error ? err.message : String(err);
}

/** Token revocato/scaduto: l'unico rimedio è ricollegare l'account. */
export function isInvalidGrant(err: unknown) {
  const e = err as { message?: string; response?: { data?: { error?: string } } };
  return e?.response?.data?.error === "invalid_grant" || /invalid_grant/i.test(errorMessage(err));
}

/** Client OAuth autenticato per l'utente (DB, con fallback sull'env legacy). */
export async function getAuthorizedGoogleClient(userId: string) {
  const row = await loadConnection(userId);
  const refreshToken = row?.refresh_token ?? process.env.GOOGLE_REFRESH_TOKEN;
  if (!refreshToken) throw new GoogleNotConnectedError();
  const client = createGoogleOAuthClient();
  client.setCredentials({ refresh_token: refreshToken });
  if (row) {
    // Google a volte ruota il refresh token: se arriva, salvalo.
    client.on("tokens", (tokens) => {
      if (tokens.refresh_token && tokens.refresh_token !== refreshToken) {
        void createSupabaseAdminClient()
          .from("google_connections")
          .update({ refresh_token: tokens.refresh_token, updated_at: new Date().toISOString() })
          .eq("user_id", userId);
      }
    });
  }
  return client;
}
