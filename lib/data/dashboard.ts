import { createSupabaseClient, requireUserId } from "@/lib/supabase-server";

const STALE_DAYS = 7;
const OVERDUE_PAYMENT_DAYS = 30;

export type DashboardDeadlineItem = {
  id: string;
  collaborationId: string;
  title: string;
  brandName: string;
  type: string;
  publishDate: string;
};

export type DashboardStaleItem = {
  id: string;
  title: string;
  brandName: string;
  status: string;
  daysStale: number;
};

export type DashboardOverduePaymentItem = {
  id: string;
  title: string;
  brandName: string;
  remaining: number;
  agreedFee: number;
};

export type DashboardTopBrand = {
  brandId: string;
  brandName: string;
  totalAgreedFee: number;
};

export type DashboardMonthPoint = {
  month: string;
  sponsor: number;
  youtube: number;
  total: number;
};

export type DashboardOverview = {
  priorities: {
    deadlines7d: { count: number; items: DashboardDeadlineItem[] };
    staleResponse: { count: number; items: DashboardStaleItem[] };
    overduePayments: { count: number; items: DashboardOverduePaymentItem[]; totalRemaining: number };
    activeGiveaways: { count: number; estimatedValue: number };
  };
  month: {
    earnings: number;
    earningsPrev: number;
    earningsMomPct: number | null;
    pipelineCertain: number;
    pipelineProbable: number;
    openDeals: number;
    openByStatus: { proposta: number; inValutazione: number; accettata: number };
  };
  trend12m: DashboardMonthPoint[];
  topBrands: DashboardTopBrand[];
};

function toYmd(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
}

function monthBounds(year: number, monthIndex: number) {
  const start = new Date(year, monthIndex, 1);
  const end = new Date(year, monthIndex + 1, 0);
  return { start: toYmd(start), end: toYmd(end) };
}

function currentMonthBounds() {
  const now = new Date();
  return monthBounds(now.getFullYear(), now.getMonth());
}

function previousMonthBounds() {
  const now = new Date();
  const d = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  return monthBounds(d.getFullYear(), d.getMonth());
}

function yearBounds(year: number) {
  return { start: `${year}-01-01`, end: `${year}-12-31` };
}

function brandNameFromJoin(
  brands: { name: string } | { name: string }[] | null
): string {
  if (!brands) return "Brand";
  if (Array.isArray(brands)) return brands[0]?.name ?? "Brand";
  return brands.name;
}

function num(v: number | string | null | undefined): number {
  if (v == null) return 0;
  const n = typeof v === "number" ? v : Number(String(v).replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

function last12MonthKeys(): string[] {
  const keys: string[] = [];
  const now = new Date();
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    keys.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  }
  return keys;
}

export async function getDashboardOverview(): Promise<DashboardOverview> {
  const [supabase, userId] = await Promise.all([createSupabaseClient(), requireUserId()]);

  const today = new Date();
  const todayYmd = toYmd(today);
  const in7 = new Date(today);
  in7.setDate(today.getDate() + 7);
  const in7Ymd = toYmd(in7);

  const staleCutoff = new Date(today);
  staleCutoff.setDate(today.getDate() - STALE_DAYS);
  const staleCutoffIso = staleCutoff.toISOString();

  const overdueCutoff = new Date(today);
  overdueCutoff.setDate(today.getDate() - OVERDUE_PAYMENT_DAYS);
  const overdueCutoffIso = overdueCutoff.toISOString();

  const curMonth = currentMonthBounds();
  const prevMonth = previousMonthBounds();
  const year = today.getFullYear();
  const yBounds = yearBounds(year);

  const [
    delivRes,
    collabRes,
    paymentsRes,
    finRes,
  ] = await Promise.all([
    supabase
      .from("deliverables")
      .select(
        `id, type, publish_date, status, collaboration_id,
        collaborations ( id, brief_text, status, brands ( name ) )`
      )
      .eq("user_id", userId)
      .not("publish_date", "is", null)
      .gte("publish_date", todayYmd)
      .lte("publish_date", in7Ymd)
      .neq("status", "pubblicato")
      .order("publish_date", { ascending: true }),
    supabase
      .from("collaborations")
      .select(
        "id, status, agreed_fee, created_at, is_giveaway, giveaway_value, brief_text, brand_id, brands ( id, name )"
      )
      .eq("user_id", userId),
    supabase
      .from("collaboration_payments")
      .select("collaboration_id, amount, paid_at")
      .eq("user_id", userId),
    supabase
      .from("financials")
      .select("type, amount, date")
      .eq("user_id", userId)
      .eq("type", "Entrata YouTube"),
  ]);

  type CollabRow = {
    id: string;
    status: string;
    agreed_fee: number | string | null;
    created_at: string;
    is_giveaway: boolean | null;
    giveaway_value: number | string | null;
    brief_text: string | null;
    brand_id: string;
    brands: { id: string; name: string } | { id: string; name: string }[] | null;
  };

  const collabs = (collabRes.data ?? []) as CollabRow[];
  const paidByCollab = new Map<string, number>();
  for (const p of (paymentsRes.data ?? []) as {
    collaboration_id: string;
    amount: number | string;
    paid_at: string;
  }[]) {
    const id = p.collaboration_id;
    paidByCollab.set(id, (paidByCollab.get(id) ?? 0) + num(p.amount));
  }

  const deadlines7d: DashboardDeadlineItem[] = [];
  for (const row of (delivRes.data ?? []) as {
    id: string;
    type: string;
    publish_date: string;
    collaboration_id: string;
    collaborations:
      | {
          id: string;
          brief_text: string | null;
          brands: { name: string } | { name: string }[] | null;
        }
      | {
          id: string;
          brief_text: string | null;
          brands: { name: string } | { name: string }[] | null;
        }[]
      | null;
  }[]) {
    const c = Array.isArray(row.collaborations)
      ? row.collaborations[0]
      : row.collaborations;
    if (!c) continue;
    deadlines7d.push({
      id: row.id,
      collaborationId: c.id,
      title: c.brief_text?.trim() || "Senza titolo",
      brandName: brandNameFromJoin(c.brands),
      type: row.type,
      publishDate: row.publish_date,
    });
  }

  const staleResponse: DashboardStaleItem[] = [];
  for (const c of collabs) {
    if (c.status !== "proposta" && c.status !== "in valutazione") continue;
    if (c.created_at >= staleCutoffIso) continue;
    const created = new Date(c.created_at);
    const daysStale = Math.floor(
      (today.getTime() - created.getTime()) / (1000 * 60 * 60 * 24)
    );
    staleResponse.push({
      id: c.id,
      title: c.brief_text?.trim() || "Senza titolo",
      brandName: brandNameFromJoin(c.brands),
      status: c.status,
      daysStale,
    });
  }
  staleResponse.sort((a, b) => b.daysStale - a.daysStale);

  const overduePayments: DashboardOverduePaymentItem[] = [];
  let totalRemaining = 0;
  for (const c of collabs) {
    if (c.status !== "completata") continue;
    if (c.created_at >= overdueCutoffIso) continue;
    const agreed = num(c.agreed_fee);
    if (agreed <= 0) continue;
    const paid = paidByCollab.get(c.id) ?? 0;
    const remaining = Math.max(0, agreed - paid);
    if (remaining <= 0) continue;
    totalRemaining += remaining;
    overduePayments.push({
      id: c.id,
      title: c.brief_text?.trim() || "Senza titolo",
      brandName: brandNameFromJoin(c.brands),
      remaining,
      agreedFee: agreed,
    });
  }
  overduePayments.sort((a, b) => b.remaining - a.remaining);

  let activeGiveawayCount = 0;
  let activeGiveawayValue = 0;
  for (const c of collabs) {
    if (c.status === "completata" || c.status === "rifiutata") continue;
    if (c.is_giveaway !== true) continue;
    activeGiveawayCount += 1;
    activeGiveawayValue += num(c.giveaway_value);
  }

  let earnings = 0;
  let earningsPrev = 0;
  for (const p of (paymentsRes.data ?? []) as { amount: number | string; paid_at: string }[]) {
    const amt = num(p.amount);
    const d = p.paid_at;
    if (d >= curMonth.start && d <= curMonth.end) earnings += amt;
    if (d >= prevMonth.start && d <= prevMonth.end) earningsPrev += amt;
  }
  for (const f of (finRes.data ?? []) as {
    amount: number | string;
    date: string;
  }[]) {
    const amt = num(f.amount);
    if (amt <= 0) continue;
    const d = String(f.date);
    if (d >= curMonth.start && d <= curMonth.end) earnings += amt;
    if (d >= prevMonth.start && d <= prevMonth.end) earningsPrev += amt;
  }

  const earningsMomPct =
    earningsPrev > 0
      ? Math.round(((earnings - earningsPrev) / earningsPrev) * 100)
      : earnings > 0
        ? 100
        : null;

  let pipelineCertain = 0;
  let pipelineProbable = 0;
  let openDeals = 0;
  const openByStatus = { proposta: 0, inValutazione: 0, accettata: 0 };

  for (const c of collabs) {
    if (c.status === "completata" || c.status === "rifiutata") continue;
    openDeals += 1;
    if (c.status === "proposta") openByStatus.proposta += 1;
    if (c.status === "in valutazione") openByStatus.inValutazione += 1;
    if (c.status === "accettata") openByStatus.accettata += 1;

    const agreed = num(c.agreed_fee);
    if (agreed <= 0) continue;

    if (c.status === "accettata") {
      const paid = paidByCollab.get(c.id) ?? 0;
      pipelineCertain += Math.max(0, agreed - paid);
    }
    if (c.status === "in valutazione") {
      pipelineProbable += agreed;
    }
  }

  const sponsorByMonth = new Map<string, number>();
  const youtubeByMonth = new Map<string, number>();
  for (const key of last12MonthKeys()) {
    sponsorByMonth.set(key, 0);
    youtubeByMonth.set(key, 0);
  }

  for (const p of (paymentsRes.data ?? []) as { amount: number | string; paid_at: string }[]) {
    const amt = num(p.amount);
    if (amt <= 0) continue;
    const key = p.paid_at.slice(0, 7);
    if (sponsorByMonth.has(key)) {
      sponsorByMonth.set(key, (sponsorByMonth.get(key) ?? 0) + amt);
    }
  }
  for (const f of (finRes.data ?? []) as {
    amount: number | string;
    date: string;
  }[]) {
    const amt = num(f.amount);
    if (amt <= 0) continue;
    const key = String(f.date).slice(0, 7);
    if (youtubeByMonth.has(key)) {
      youtubeByMonth.set(key, (youtubeByMonth.get(key) ?? 0) + amt);
    }
  }

  const trend12m: DashboardMonthPoint[] = last12MonthKeys().map((month) => {
    const sponsor = sponsorByMonth.get(month) ?? 0;
    const youtube = youtubeByMonth.get(month) ?? 0;
    return { month, sponsor, youtube, total: sponsor + youtube };
  });

  const brandTotals = new Map<string, { name: string; total: number }>();
  for (const c of collabs) {
    const created = c.created_at.slice(0, 10);
    if (created < yBounds.start || created > yBounds.end) continue;
    const agreed = num(c.agreed_fee);
    if (agreed <= 0) continue;
    const brand = Array.isArray(c.brands) ? c.brands[0] : c.brands;
    if (!brand?.id) continue;
    const cur = brandTotals.get(brand.id) ?? { name: brand.name, total: 0 };
    cur.total += agreed;
    brandTotals.set(brand.id, cur);
  }

  const topBrands: DashboardTopBrand[] = [...brandTotals.entries()]
    .map(([brandId, v]) => ({
      brandId,
      brandName: v.name,
      totalAgreedFee: v.total,
    }))
    .sort((a, b) => b.totalAgreedFee - a.totalAgreedFee)
    .slice(0, 5);

  return {
    priorities: {
      deadlines7d: {
        count: deadlines7d.length,
        items: deadlines7d.slice(0, 6),
      },
      staleResponse: {
        count: staleResponse.length,
        items: staleResponse.slice(0, 5),
      },
      overduePayments: {
        count: overduePayments.length,
        items: overduePayments.slice(0, 5),
        totalRemaining,
      },
      activeGiveaways: {
        count: activeGiveawayCount,
        estimatedValue: activeGiveawayValue,
      },
    },
    month: {
      earnings,
      earningsPrev,
      earningsMomPct,
      pipelineCertain,
      pipelineProbable,
      openDeals,
      openByStatus,
    },
    trend12m,
    topBrands,
  };
}

export function formatDashboardEur(n: number) {
  return new Intl.NumberFormat("it-IT", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(n);
}

export function formatDashboardMonthLabel(monthKey: string) {
  const [y, m] = monthKey.split("-").map(Number);
  return new Date(y, (m ?? 1) - 1, 1).toLocaleDateString("it-IT", {
    month: "short",
    year: "2-digit",
  });
}
