import { createSupabaseClient, requireUserId } from "@/lib/supabase-server";
import { mapStatusToKanban } from "@/lib/types";
import { formatEur, formatEurOrNull, toNumberOrNull } from "@/lib/format";
import { isExpenseType, isManualFinancialType } from "@/lib/financial-types";
import type { KanbanCollaboration } from "@/lib/types";

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

export type GetCollaborationsOptions = {
  /** ISO date inclusivo (YYYY-MM-DD), confrontato con `created_at`. */
  startDate?: string;
  /** ISO date inclusivo (YYYY-MM-DD), confrontato con `created_at`. */
  endDate?: string;
  /** Testo libero: filtra per `brief_text` o nome brand (case-insensitive). */
  query?: string;
};

export type GetCollaborationsResult = {
  items: KanbanCollaboration[];
  /** Totale collaborazioni dell'utente (senza filtri), per mostrare "X di Y". */
  totalCount: number;
};

/** Lista collaborazioni filtrata. Filtri opzionali su `created_at` e ricerca testuale. */
export async function getCollaborations(
  opts: GetCollaborationsOptions = {}
): Promise<GetCollaborationsResult> {
  const [supabase, userId] = await Promise.all([createSupabaseClient(), requireUserId()]);

  const totalRes = await supabase
    .from("collaborations")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId);
  const totalCount = totalRes.count ?? 0;

  let q = supabase
    .from("collaborations")
    .select(
      "id, status, agreed_fee, brief_text, is_giveaway, giveaway_value, brands ( name )"
    )
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (opts.startDate) q = q.gte("created_at", `${opts.startDate}T00:00:00`);
  if (opts.endDate) q = q.lte("created_at", `${opts.endDate}T23:59:59`);

  const { data, error } = await q;

  if (error) {
    if (process.env.NODE_ENV === "development")
      console.warn("[CreatorCRM] collaborazioni:", error.message);
    return { items: [], totalCount };
  }
  if (!data?.length) {
    return { items: [], totalCount };
  }

  const needle = (opts.query ?? "").trim().toLowerCase();
  const items = data
    .map((row: unknown) => {
      const c = row as CollabRow;
      return {
        id: c.id,
        title: c.brief_text?.trim() || "Senza titolo",
        brandName: brandName(c.brands),
        agreedFee: formatEurOrNull(c.agreed_fee),
        isGiveaway: c.is_giveaway === true,
        giveawayValue: formatEurOrNull(c.giveaway_value),
        kanbanStatus: mapStatusToKanban(c.status),
      };
    })
    .filter((it) => {
      if (!needle) return true;
      return (
        it.title.toLowerCase().includes(needle) ||
        it.brandName.toLowerCase().includes(needle)
      );
    });

  return { items, totalCount };
}

export type BrandRow = {
  id: string;
  name: string;
  sector: string | null;
  contacts: string | null;
  /** Rubrica strutturata (JSON), se la migration è applicata */
  contacts_json: unknown;
  notes: string | null;
  billing_name?: string | null;
  billing_address?: string | null;
  vat_number?: string | null;
  billing_extra?: string | null;
  receipt_language?: string | null;
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
    .select(
      "id, name, sector, contacts, contacts_json, notes, billing_name, billing_address, vat_number, billing_extra, receipt_language"
    )
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
    .select(
      "id, name, sector, contacts, contacts_json, notes, billing_name, billing_address, vat_number, billing_extra, receipt_language"
    )
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

export type DateRange = {
  startDate?: string;
  endDate?: string;
};

export type FinancialRow = {
  id: string;
  type: string;
  /** Importo con segno, già formattato. */
  amount: string;
  date: string;
  collaboration: string | null;
  description: string | null;
  /** Presente solo per i movimenti manuali (modificabili). */
  manual: {
    type: string;
    amount: number;
    date: string;
    description: string;
    collaborationId: string | null;
  } | null;
};

type CollabBrandJoin =
  | {
      brief_text: string | null;
      brands: { name: string } | { name: string }[] | null;
    }
  | {
      brief_text: string | null;
      brands: { name: string } | { name: string }[] | null;
    }[]
  | null;

function collabLabel(join: CollabBrandJoin): string | null {
  const one = Array.isArray(join) ? join[0] : join;
  const collab = one?.brief_text?.trim();
  const brandJoin = one?.brands;
  const brand = Array.isArray(brandJoin) ? brandJoin[0]?.name : brandJoin?.name;
  if (collab) return brand ? `${collab} · ${brand}` : collab;
  return brand ?? null;
}

function formatDay(iso: string) {
  return new Date(iso + "T12:00:00").toLocaleDateString("it-IT", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

/**
 * Movimenti in tabella Finanze: YouTube aggregato per mese (già mensile in DB),
 * movimenti manuali uno per riga. Le spese hanno segno negativo.
 */
export async function getFinancialsByRange(range?: DateRange): Promise<FinancialRow[]> {
  const [supabase, userId] = await Promise.all([createSupabaseClient(), requireUserId()]);
  let query = supabase
    .from("financials")
    .select(
      "id, type, amount, date, description, collaboration_id, collaborations ( brief_text, brands ( name ) )"
    )
    .eq("user_id", userId)
    .order("date", { ascending: false });
  if (range?.startDate) query = query.gte("date", range.startDate);
  if (range?.endDate) query = query.lte("date", range.endDate);
  const { data, error } = await query;
  if (error) {
    console.warn("[CreatorCRM] financials:", error.message);
    return [];
  }

  const monthlyYoutube = new Map<string, number>();
  const rows: (FinancialRow & { sortDate: string })[] = [];
  for (const row of (data ?? []) as {
    id: string;
    type: string;
    amount: number | string | null;
    date: string;
    description: string | null;
    collaboration_id: string | null;
    collaborations: CollabBrandJoin;
  }[]) {
    const amountNum = Math.abs(toNumberOrNull(row.amount) ?? 0);
    const isoDate = String(row.date);
    if (row.type === "Entrata YouTube") {
      const month = isoDate.slice(0, 7);
      monthlyYoutube.set(month, (monthlyYoutube.get(month) ?? 0) + amountNum);
      continue;
    }
    const signed = isExpenseType(row.type) ? -amountNum : amountNum;
    rows.push({
      id: row.id,
      type: row.type,
      amount: formatEur(signed, { signed: true }),
      date: formatDay(isoDate),
      sortDate: isoDate,
      collaboration: collabLabel(row.collaborations),
      description: row.description,
      manual: isManualFinancialType(row.type)
        ? {
            type: row.type,
            amount: amountNum,
            date: isoDate,
            description: row.description ?? "",
            collaborationId: row.collaboration_id,
          }
        : null,
    });
  }
  for (const [month, amount] of monthlyYoutube) {
    rows.push({
      id: `yt-month-${month}`,
      type: "Entrata YouTube",
      amount: formatEur(amount, { signed: true }),
      date: new Date(`${month}-01T12:00:00`).toLocaleDateString("it-IT", {
        month: "short",
        year: "numeric",
      }),
      sortDate: `${month}-31`,
      collaboration: null,
      description: "Aggregato mensile (sync YouTube)",
      manual: null,
    });
  }
  return rows
    .sort((a, b) => b.sortDate.localeCompare(a.sortDate))
    .map((r) => ({
      id: r.id,
      type: r.type,
      amount: r.amount,
      date: r.date,
      collaboration: r.collaboration,
      description: r.description,
      manual: r.manual,
    }));
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
  /** "Altra entrata" (affiliazioni ecc.). */
  otherIncomeTotal: number;
  expensesTotal: number;
  /** Entrate totali meno spese. */
  netTotal: number;
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
    .eq("user_id", userId);
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
  let otherIncomeTotal = 0;
  let expensesTotal = 0;

  for (const row of (finRes.data ?? []) as {
    type: string;
    amount: number | string | null;
    date: string;
  }[]) {
    const amount = Math.abs(Number(row.amount ?? 0));
    if (!Number.isFinite(amount) || amount <= 0) continue;
    const key = monthKey(row.date);
    if (isExpenseType(row.type)) {
      expensesTotal += amount;
    } else if (row.type === "Altra entrata") {
      otherIncomeTotal += amount;
    } else if (row.type === "Entrata YouTube") {
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
  const overallTotal = youtubeTotal + sponsorTotal + otherIncomeTotal;
  const youtubePct = overallTotal > 0 ? Math.round((youtubeTotal / overallTotal) * 100) : 0;
  const sponsorPct = overallTotal > 0 ? Math.round((sponsorTotal / overallTotal) * 100) : 0;

  const trendToArray = (map: Map<string, number>) =>
    [...map.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-6)
      .map(([k, amount]) => ({ month: k, amount }));

  return {
    youtubeTotal,
    sponsorTotal,
    otherIncomeTotal,
    expensesTotal,
    netTotal: overallTotal - expensesTotal,
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
      amount: formatEur(Number(r.amount ?? 0)),
      collaboration: c
        ? b
          ? `${c} · ${b}`
          : c
        : b ?? "Collaborazione",
      note: r.note,
    };
  });
}

export type CollaborationOption = { id: string; label: string };

/** Elenco compatto per le select (titolo · brand), più recenti prima. */
export async function getCollaborationOptions(): Promise<CollaborationOption[]> {
  const [supabase, userId] = await Promise.all([createSupabaseClient(), requireUserId()]);
  const { data } = await supabase
    .from("collaborations")
    .select("id, brief_text, brands ( name )")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  return ((data ?? []) as unknown as CollabRow[]).map((c) => ({
    id: c.id,
    label: `${c.brief_text?.trim() || "Senza titolo"} · ${brandName(c.brands)}`,
  }));
}
