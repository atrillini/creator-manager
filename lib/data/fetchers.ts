import { createSupabaseClient, requireUserId } from "@/lib/supabase-server";
import { mapStatusToKanban } from "@/lib/types";
import * as mock from "./mock";

type CollabRow = {
  id: string;
  status: string;
  agreed_fee: number | string | null;
  brief_text: string | null;
  is_giveaway: boolean | null;
  giveaway_value: number | string | null;
  brands: { name: string } | { name: string }[] | null;
};

function brandName(brand: CollabRow["brands"]): string {
  if (!brand) return "Brand";
  if (Array.isArray(brand)) return brand[0]?.name ?? "Brand";
  return brand.name;
}

function feeString(v: number | string | null | undefined): string | null {
  if (v === null || v === undefined) return null;
  if (typeof v === "string") {
    if (v.trim() === "") return null;
    const n = Number(v);
    if (!Number.isNaN(n))
      return new Intl.NumberFormat("it-IT", {
        style: "currency",
        currency: "EUR",
      }).format(n);
    return v;
  }
  return new Intl.NumberFormat("it-IT", {
    style: "currency",
    currency: "EUR",
  }).format(v);
}

/** Prova Supabase, altrimenti dati fittizi (ID mock non hanno un record reale). */
export async function getCollaborations() {
  const [supabase, userId] = await Promise.all([createSupabaseClient(), requireUserId()]);
  const { data, error } = await supabase
    .from("collaborations")
    .select(
      "id, status, agreed_fee, brief_text, is_giveaway, giveaway_value, brands ( name )"
    )
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) {
    if (process.env.NODE_ENV === "development")
      console.warn("[CreatorCRM] collaborazioni:", error.message);
    return [];
  }
  if (!data?.length) {
    return [];
  }
  return data.map((row: unknown) => {
    const c = row as CollabRow;
    const s = c.status;
    return {
      id: c.id,
      title: c.brief_text?.trim() || "Senza titolo",
      brandName: brandName(c.brands),
      agreedFee: feeString(c.agreed_fee),
      isGiveaway: c.is_giveaway === true,
      giveawayValue: feeString(c.giveaway_value),
      kanbanStatus: mapStatusToKanban(s),
    };
  });
}

export type BrandRow = {
  id: string;
  name: string;
  sector: string | null;
  contacts: string | null;
  /** Rubrica strutturata (JSON), se la migration è applicata */
  contacts_json: unknown;
  notes: string | null;
};

export type BrandCollabLink = {
  id: string;
  /** Titolo breve (brief) per la pillola */
  title: string;
};

/** Riga brand per tab Aziende: include collaborazioni attive / completate. */
export type AziendeBrandRow = BrandRow & {
  activeCollaborations: BrandCollabLink[];
  pastCollaborations: BrandCollabLink[];
};

export async function getBrands(): Promise<BrandRow[]> {
  const [supabase, userId] = await Promise.all([createSupabaseClient(), requireUserId()]);
  const { data, error } = await supabase
    .from("brands")
    .select("id, name, sector, contacts, contacts_json, notes")
    .eq("user_id", userId)
    .order("name", { ascending: true });
  if (error) {
    if (process.env.NODE_ENV === "development")
      console.warn("[CreatorCRM] brands:", error.message);
    return [];
  }
  return (data as BrandRow[]) ?? [];
}

const COMPLETATA = "completata";

/**
 * Brand per la tab Aziende con elenco collaborazioni: attive = tutto tranne
 * `completata`; passate = solo `completata`. Ordinamento per `created_at` decrescente.
 */
export async function getAziendeTableBrands(): Promise<AziendeBrandRow[]> {
  const [supabase, userId] = await Promise.all([createSupabaseClient(), requireUserId()]);
  const { data: brands, error: brandsError } = await supabase
    .from("brands")
    .select("id, name, sector, contacts, contacts_json, notes")
    .eq("user_id", userId)
    .order("name", { ascending: true });

  if (brandsError) {
    if (process.env.NODE_ENV === "development")
      console.warn("[CreatorCRM] brands (aziende):", brandsError.message);
    return [];
  }
  if (!brands?.length) {
    return [];
  }

  const { data: collabs, error: collabsError } = await supabase
    .from("collaborations")
    .select("id, brand_id, status, brief_text, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (collabsError && process.env.NODE_ENV === "development") {
    console.warn("[CreatorCRM] collaborations (aziende):", collabsError.message);
  }

  const byBrand = new Map<
    string,
    { active: BrandCollabLink[]; past: BrandCollabLink[] }
  >();
  for (const b of brands) {
    byBrand.set(b.id, { active: [], past: [] });
  }

  for (const row of (collabs ?? []) as {
    id: string;
    brand_id: string;
    status: string;
    brief_text: string | null;
  }[]) {
    if (!row.brand_id) continue;
    const slot = byBrand.get(row.brand_id);
    if (!slot) continue;
    const title = row.brief_text?.trim() || "Senza titolo";
    const item: BrandCollabLink = { id: row.id, title };
    if (row.status === COMPLETATA) {
      slot.past.push(item);
    } else {
      slot.active.push(item);
    }
  }

  return (brands as BrandRow[]).map((b) => {
    const c = byBrand.get(b.id) ?? { active: [], past: [] };
    return {
      ...b,
      activeCollaborations: c.active,
      pastCollaborations: c.past,
    };
  });
}

export async function getDashboardStats() {
  const _s = await createSupabaseClient();
  void _s;
  return mock.getMockDashboardStats();
}

export async function getFinancials() {
  return getFinancialsByRange();
}

export type DateRange = {
  startDate?: string;
  endDate?: string;
};

export async function getFinancialsByRange(range?: DateRange) {
  const [supabase, userId] = await Promise.all([createSupabaseClient(), requireUserId()]);
  let query = supabase
    .from("financials")
    .select("id, type, amount, date, collaborations ( brief_text, brands ( name ) )")
    .eq("user_id", userId)
    .order("date", { ascending: false });
  if (range?.startDate) query = query.gte("date", range.startDate);
  if (range?.endDate) query = query.lte("date", range.endDate);
  const { data, error } = await query;
  if (error || !data) {
    if (process.env.NODE_ENV === "development" && error) {
      console.warn("[CreatorCRM] financials:", error.message);
    }
    return mock.getMockFinancials();
  }
  const monthlyYoutube = new Map<string, number>();
  const otherRows: {
    id: string;
    type: string;
    amount: string;
    date: string;
    sortDate: string;
    collaboration: string | null;
  }[] = [];
  for (const row of data as {
    id: string;
    type: string;
    amount: number | string | null;
    date: string;
    collaborations:
      | {
          brief_text: string | null;
          brands: { name: string } | { name: string }[] | null;
        }
      | {
          brief_text: string | null;
          brands: { name: string } | { name: string }[] | null;
        }[]
      | null;
  }[]) {
    const amountNum = Number(row.amount ?? 0);
    if (row.type === "Entrata YouTube") {
      const month = String(row.date).slice(0, 7);
      monthlyYoutube.set(month, (monthlyYoutube.get(month) ?? 0) + amountNum);
      continue;
    }
    const amount = new Intl.NumberFormat("it-IT", {
      style: "currency",
      currency: "EUR",
      signDisplay: amountNum >= 0 ? "always" : "auto",
    }).format(amountNum);
    const collabJoin = row.collaborations;
    const one = Array.isArray(collabJoin) ? collabJoin[0] : collabJoin;
    const collab = one?.brief_text;
    const brandJoin = one?.brands;
    const brand = Array.isArray(brandJoin) ? brandJoin[0]?.name : brandJoin?.name;
    const isoDate = String(row.date);
    otherRows.push({
      id: row.id,
      type: row.type,
      amount,
      date: new Date(isoDate + "T12:00:00").toLocaleDateString("it-IT", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      }),
      sortDate: isoDate,
      collaboration: collab
        ? brand
          ? `${collab} · ${brand}`
          : collab
        : brand ?? null,
    });
  }
  const youtubeRows = [...monthlyYoutube.entries()]
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([month, amount], idx) => ({
      id: `yt-month-${month}-${idx}`,
      type: "Entrata YouTube",
      amount: new Intl.NumberFormat("it-IT", {
        style: "currency",
        currency: "EUR",
        signDisplay: amount >= 0 ? "always" : "auto",
      }).format(amount),
      date: new Date(`${month}-01T12:00:00`).toLocaleDateString("it-IT", {
        month: "short",
        year: "numeric",
      }),
      sortDate: `${month}-31`,
      collaboration: "Aggregato mensile",
    }));
  return [...youtubeRows, ...otherRows]
    .sort((a, b) => b.sortDate.localeCompare(a.sortDate))
    .map(({ sortDate: _sortDate, ...row }) => row);
}

export type YoutubeStatsRow = {
  channelName: string;
  subscriberCount: number;
  viewCount: number;
  avatarUrl: string | null;
  updatedAt: string;
};

export async function getLatestYoutubeStats(): Promise<YoutubeStatsRow | null> {
  const [supabase, userId] = await Promise.all([createSupabaseClient(), requireUserId()]);
  const { data, error } = await supabase
    .from("youtube_stats")
    .select("channel_name, subscriber_count, view_count, avatar_url, updated_at")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error || !data) {
    if (process.env.NODE_ENV === "development" && error) {
      console.warn("[CreatorCRM] youtube_stats:", error.message);
    }
    return null;
  }
  return {
    channelName: data.channel_name ?? "Canale YouTube",
    subscriberCount: Number(data.subscriber_count ?? 0),
    viewCount: Number(data.view_count ?? 0),
    avatarUrl: data.avatar_url ?? null,
    updatedAt: data.updated_at ?? new Date().toISOString(),
  };
}

export type FinancialSplitData = {
  youtubeTotal: number;
  sponsorTotal: number;
  sponsorForecastTotal: number;
  sponsorActualPct: number;
  overallTotal: number;
  youtubePct: number;
  sponsorPct: number;
  youtubeTrend: { month: string; amount: number }[];
  sponsorTrend: { month: string; amount: number }[];
};

function monthKey(raw: string) {
  const d = new Date(raw + "T12:00:00");
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export async function getFinancialSplitData(range?: DateRange): Promise<FinancialSplitData> {
  const [supabase, userId] = await Promise.all([createSupabaseClient(), requireUserId()]);
  let finQuery = supabase
    .from("financials")
    .select("type, amount, date")
    .eq("user_id", userId)
    .in("type", ["Entrata YouTube", "Entrata Sponsor"]);
  if (range?.startDate) finQuery = finQuery.gte("date", range.startDate);
  if (range?.endDate) finQuery = finQuery.lte("date", range.endDate);

  let paymentsQuery = supabase
    .from("collaboration_payments")
    .select("amount, paid_at")
    .eq("user_id", userId);
  if (range?.startDate) paymentsQuery = paymentsQuery.gte("paid_at", range.startDate);
  if (range?.endDate) paymentsQuery = paymentsQuery.lte("paid_at", range.endDate);

  let forecastQuery = supabase
    .from("collaborations")
    .select("agreed_fee")
    .eq("user_id", userId)
    .in("status", ["accettata", "completata"])
    .not("agreed_fee", "is", null);
  if (range?.startDate) forecastQuery = forecastQuery.gte("created_at", `${range.startDate}T00:00:00`);
  if (range?.endDate) forecastQuery = forecastQuery.lte("created_at", `${range.endDate}T23:59:59`);

  const [finRes, paymentsRes, forecastRes] = await Promise.all([
    finQuery,
    paymentsQuery,
    forecastQuery,
  ]);

  const yMap = new Map<string, number>();
  const sMap = new Map<string, number>();
  let youtubeTotal = 0;
  let sponsorFromFinancials = 0;

  for (const row of (finRes.data ?? []) as {
    type: string;
    amount: number | string | null;
    date: string;
  }[]) {
    const amount = Number(row.amount ?? 0);
    if (!Number.isFinite(amount) || amount <= 0) continue;
    const key = monthKey(row.date);
    if (row.type === "Entrata YouTube") {
      youtubeTotal += amount;
      yMap.set(key, (yMap.get(key) ?? 0) + amount);
    } else if (row.type === "Entrata Sponsor") {
      sponsorFromFinancials += amount;
      sMap.set(key, (sMap.get(key) ?? 0) + amount);
    }
  }

  let sponsorFromPayments = 0;
  for (const row of (paymentsRes.data ?? []) as {
    amount: number | string | null;
    paid_at: string;
  }[]) {
    const amount = Number(row.amount ?? 0);
    if (!Number.isFinite(amount) || amount <= 0) continue;
    sponsorFromPayments += amount;
    const key = monthKey(row.paid_at);
    sMap.set(key, (sMap.get(key) ?? 0) + amount);
  }

  const sponsorTotal = sponsorFromFinancials + sponsorFromPayments;
  const sponsorForecastTotal = (forecastRes.data ?? []).reduce(
    (acc, r) => acc + Number((r as { agreed_fee: number | string | null }).agreed_fee ?? 0),
    0
  );
  const sponsorActualPct =
    sponsorForecastTotal > 0
      ? Math.min(100, Math.round((sponsorTotal / sponsorForecastTotal) * 100))
      : 0;
  const overallTotal = youtubeTotal + sponsorTotal;
  const youtubePct = overallTotal > 0 ? Math.round((youtubeTotal / overallTotal) * 100) : 0;
  const sponsorPct = overallTotal > 0 ? 100 - youtubePct : 0;

  const trendToArray = (map: Map<string, number>) =>
    [...map.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-6)
      .map(([k, amount]) => ({ month: k, amount }));

  return {
    youtubeTotal,
    sponsorTotal,
    sponsorForecastTotal,
    sponsorActualPct,
    overallTotal,
    youtubePct,
    sponsorPct,
    youtubeTrend: trendToArray(yMap),
    sponsorTrend: trendToArray(sMap),
  };
}

export type CollaborationPaymentAuditRow = {
  id: string;
  date: string;
  amount: string;
  collaboration: string;
  note: string | null;
};

export async function getRecentCollaborationPayments(
  range?: DateRange
): Promise<CollaborationPaymentAuditRow[]> {
  const [supabase, userId] = await Promise.all([createSupabaseClient(), requireUserId()]);
  let q = supabase
    .from("collaboration_payments")
    .select("id, amount, paid_at, note, collaborations ( brief_text, brands ( name ) )")
    .eq("user_id", userId)
    .order("paid_at", { ascending: false })
    .limit(20);
  if (range?.startDate) q = q.gte("paid_at", range.startDate);
  if (range?.endDate) q = q.lte("paid_at", range.endDate);
  const { data, error } = await q;
  if (error || !data) return [];
  return (data as {
    id: string;
    amount: number | string;
    paid_at: string;
    note: string | null;
    collaborations:
      | {
          brief_text: string | null;
          brands: { name: string } | { name: string }[] | null;
        }
      | {
          brief_text: string | null;
          brands: { name: string } | { name: string }[] | null;
        }[]
      | null;
  }[]).map((r) => {
    const one = Array.isArray(r.collaborations)
      ? r.collaborations[0]
      : r.collaborations;
    const c = one?.brief_text;
    const bJoin = one?.brands;
    const b = Array.isArray(bJoin) ? bJoin[0]?.name : bJoin?.name;
    return {
      id: r.id,
      date: new Date(r.paid_at + "T12:00:00").toLocaleDateString("it-IT"),
      amount: new Intl.NumberFormat("it-IT", {
        style: "currency",
        currency: "EUR",
      }).format(Number(r.amount ?? 0)),
      collaboration: c
        ? b
          ? `${c} · ${b}`
          : c
        : b ?? "Collaborazione",
      note: r.note,
    };
  });
}
