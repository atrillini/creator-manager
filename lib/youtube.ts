import "server-only";
import { google } from "googleapis";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getAuthorizedGoogleClient, recordGoogleSyncResult } from "@/lib/google-auth";

type GoogleAuth = Awaited<ReturnType<typeof getAuthorizedGoogleClient>>;

type YoutubeChannelSnapshot = {
  channelName: string;
  subscriberCount: number;
  viewCount: number;
  avatarUrl: string | null;
};

type YoutubeRevenuePoint = {
  date: string;
  amount: number;
};

type GoogleApiErrorLike = {
  message?: string;
  code?: number;
  response?: {
    status?: number;
    data?: unknown;
  };
  errors?: unknown;
};

function formatGoogleError(stage: string, err: unknown): Error {
  const e = err as GoogleApiErrorLike;
  const status = e?.response?.status ?? e?.code ?? "unknown";
  const message = e?.message ?? "Unknown Google API error";
  let detail = "";
  try {
    if (e?.response?.data) {
      detail = JSON.stringify(e.response.data);
    } else if (e?.errors) {
      detail = JSON.stringify(e.errors);
    }
  } catch {
    detail = "";
  }
  return new Error(`[${stage}] status=${status} message=${message}${detail ? ` detail=${detail}` : ""}`);
}

async function fetchChannelSnapshot(auth: GoogleAuth): Promise<YoutubeChannelSnapshot> {
  const youtube = google.youtube({ version: "v3", auth });
  const channelId = process.env.YOUTUBE_CHANNEL_ID;
  let res;
  try {
    res = channelId
      ? await youtube.channels.list({
          part: ["snippet", "statistics"],
          id: [channelId],
        })
      : await youtube.channels.list({
          part: ["snippet", "statistics"],
          mine: true,
        });
  } catch (err) {
    throw formatGoogleError("youtube.channels.list", err);
  }

  const item = res.data.items?.[0];
  if (!item) {
    throw new Error("YouTube channel not found");
  }
  const stats = item.statistics;
  const snippet = item.snippet;
  return {
    channelName: snippet?.title ?? "Canale YouTube",
    subscriberCount: Number(stats?.subscriberCount ?? 0),
    viewCount: Number(stats?.viewCount ?? 0),
    avatarUrl: snippet?.thumbnails?.high?.url ?? snippet?.thumbnails?.default?.url ?? null,
  };
}

async function fetchEstimatedRevenues(
  auth: GoogleAuth,
  startDate: string,
  endDate: string
): Promise<YoutubeRevenuePoint[]> {
  const analytics = google.youtubeAnalytics({ version: "v2", auth });
  let rows;
  try {
    rows = await analytics.reports.query({
      ids: "channel==MINE",
      startDate,
      endDate,
      metrics: "estimatedRevenue",
      dimensions: "day",
      // YouTube Analytics v2: estimated revenue defaults to USD, but supports requesting a target currency.
      // When set, the API returns values converted using daily exchange rates.
      currency: process.env.YOUTUBE_REVENUE_CURRENCY ?? "EUR",
      sort: "day",
    });
  } catch (err) {
    throw formatGoogleError("youtubeAnalytics.reports.query(estimatedRevenue)", err);
  }
  const out: YoutubeRevenuePoint[] = [];
  for (const r of rows.data.rows ?? []) {
    const date = String(r[0] ?? "");
    const amount = Number(r[1] ?? 0);
    if (!date || !Number.isFinite(amount) || amount <= 0) continue;
    out.push({ date, amount });
  }
  return out;
}

export async function getYoutubeDebugDiagnostics(userId: string) {
  const auth = await getAuthorizedGoogleClient(userId);
  const oauth2 = google.oauth2({ version: "v2", auth });
  const youtube = google.youtube({ version: "v3", auth });
  const analytics = google.youtubeAnalytics({ version: "v2", auth });
  const configuredChannelId = process.env.YOUTUBE_CHANNEL_ID ?? null;

  const diag: Record<string, unknown> = {
    configuredChannelId,
  };

  try {
    const tokenInfo = await oauth2.tokeninfo();
    diag.oauthScopes = tokenInfo.data.scope ?? null;
  } catch (err) {
    diag.oauthScopesError = formatGoogleError("oauth2.tokeninfo", err).message;
  }

  try {
    const mine = await youtube.channels.list({
      part: ["id", "snippet", "statistics"],
      mine: true,
      maxResults: 5,
    });
    diag.mineChannels = (mine.data.items ?? []).map((c) => ({
      id: c.id ?? null,
      title: c.snippet?.title ?? null,
      subscribers: c.statistics?.subscriberCount ?? null,
      views: c.statistics?.viewCount ?? null,
    }));
  } catch (err) {
    diag.mineChannelsError = formatGoogleError("youtube.channels.list(mine=true)", err).message;
  }

  if (configuredChannelId) {
    try {
      const byId = await youtube.channels.list({
        part: ["id", "snippet", "statistics"],
        id: [configuredChannelId],
      });
      diag.configuredChannel = (byId.data.items ?? []).map((c) => ({
        id: c.id ?? null,
        title: c.snippet?.title ?? null,
      }));
    } catch (err) {
      diag.configuredChannelError = formatGoogleError(
        "youtube.channels.list(id=YOUTUBE_CHANNEL_ID)",
        err
      ).message;
    }
  }

  const end = new Date();
  const start = new Date(end);
  start.setDate(end.getDate() - 7);
  const startDate = start.toISOString().slice(0, 10);
  const endDate = end.toISOString().slice(0, 10);
  diag.analyticsRange = { startDate, endDate };

  try {
    const rev = await analytics.reports.query({
      ids: "channel==MINE",
      startDate,
      endDate,
      metrics: "estimatedRevenue",
      dimensions: "day",
    });
    diag.monetaryRows = rev.data.rows?.length ?? 0;
  } catch (err) {
    diag.monetaryError = formatGoogleError(
      "youtubeAnalytics.reports.query(estimatedRevenue)",
      err
    ).message;
  }

  try {
    const views = await analytics.reports.query({
      ids: "channel==MINE",
      startDate,
      endDate,
      metrics: "views",
      dimensions: "day",
    });
    diag.analyticsViewsRows = views.data.rows?.length ?? 0;
  } catch (err) {
    diag.analyticsViewsError = formatGoogleError(
      "youtubeAnalytics.reports.query(views)",
      err
    ).message;
  }

  return diag;
}

function ymd(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/**
 * I ricavi vengono salvati come totale mensile: il range va allargato a mesi interi,
 * altrimenti un mese parziale sovrascriverebbe il totale già salvato.
 * Default: dal primo del mese precedente a oggi.
 */
export function resolveFullMonthRange(range?: { startDate?: string; endDate?: string }) {
  const today = new Date();
  today.setHours(12, 0, 0, 0);
  let end = range?.endDate ? new Date(`${range.endDate}T12:00:00`) : today;
  if (Number.isNaN(end.getTime()) || end > today) end = today;
  const monthEnd = new Date(end.getFullYear(), end.getMonth() + 1, 0, 12);
  end = monthEnd > today ? today : monthEnd;

  let start = range?.startDate ? new Date(`${range.startDate}T12:00:00`) : null;
  if (!start || Number.isNaN(start.getTime())) {
    start = new Date(today.getFullYear(), today.getMonth() - 1, 1, 12);
  }
  start = new Date(start.getFullYear(), start.getMonth(), 1, 12);
  if (start > end) start = new Date(end.getFullYear(), end.getMonth(), 1, 12);
  return { startDate: ymd(start), endDate: ymd(end) };
}

type SyncOptions = {
  userId: string;
  /** Client dell'utente (route API) o service role (cron): si filtra sempre per userId. */
  supabase: SupabaseClient;
  range?: { startDate?: string; endDate?: string };
};

/** Sync canale + ricavi; registra l'esito sul collegamento Google (per il banner "Ricollega"). */
export async function syncYoutubeData(opts: SyncOptions) {
  try {
    const result = await runYoutubeSync(opts);
    await recordGoogleSyncResult(opts.userId, null);
    return result;
  } catch (err) {
    await recordGoogleSyncResult(opts.userId, err).catch(() => undefined);
    throw err;
  }
}

async function runYoutubeSync({ userId, supabase, range }: SyncOptions) {
  const auth = await getAuthorizedGoogleClient(userId);
  const snapshot = await fetchChannelSnapshot(auth);
  const { startDate, endDate } = resolveFullMonthRange(range);
  let revenues: YoutubeRevenuePoint[] = [];
  let monetizationWarning: string | null = null;
  try {
    revenues = await fetchEstimatedRevenues(auth, startDate, endDate);
  } catch (err) {
    monetizationWarning = err instanceof Error ? err.message : "Monetization fetch failed";
  }

  const { error: upsertError } = await supabase.from("youtube_stats").upsert(
    {
      user_id: userId,
      channel_name: snapshot.channelName,
      subscriber_count: snapshot.subscriberCount,
      view_count: snapshot.viewCount,
      avatar_url: snapshot.avatarUrl,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id,channel_name" }
  );
  if (upsertError) throw new Error(upsertError.message);

  const monthly = new Map<string, number>();
  for (const r of revenues) {
    const monthDate = `${r.date.slice(0, 7)}-01`;
    monthly.set(monthDate, (monthly.get(monthDate) ?? 0) + r.amount);
  }
  const monthDates = [...monthly.keys()];
  const { data: existingRows, error: existingErr } = monthDates.length
    ? await supabase
      .from("financials")
      .select("id, date")
      .eq("user_id", userId)
      .eq("type", "Entrata YouTube")
      .in("date", monthDates)
    : { data: [], error: null };
  if (existingErr) throw new Error(existingErr.message);
  const existingByDate = new Map(
    (existingRows ?? []).map((r) => [String(r.date), String(r.id)])
  );

  const toInsert = monthDates
    .filter((d) => !existingByDate.has(d))
    .map((d) => ({
      type: "Entrata YouTube",
      user_id: userId,
      amount: monthly.get(d) ?? 0,
      date: d,
      collaboration_id: null,
    }));
  const toUpdate = monthDates
    .filter((d) => existingByDate.has(d))
    .map((d) => ({
      id: existingByDate.get(d) as string,
      amount: monthly.get(d) ?? 0,
    }));
  if (toInsert.length > 0) {
    const { error: insertError } = await supabase.from("financials").insert(toInsert);
    if (insertError) throw new Error(insertError.message);
  }
  for (const row of toUpdate) {
    const { error: updateError } = await supabase
      .from("financials")
      .update({ amount: row.amount })
      .eq("id", row.id)
      .eq("user_id", userId);
    if (updateError) throw new Error(updateError.message);
  }

  return {
    snapshot,
    insertedFinancialRows: toInsert.length,
    fetchedRevenueRows: monthDates.length,
    monetizationWarning,
    range: { startDate, endDate },
  };
}
