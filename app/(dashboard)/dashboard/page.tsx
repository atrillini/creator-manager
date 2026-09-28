import { DashboardHeader } from "@/components/dashboard-header";
import { DashboardMonthSummary } from "@/components/dashboard/dashboard-month-summary";
import { DashboardPriorityGrid } from "@/components/dashboard/dashboard-priority-grid";
import { DashboardTopBrands } from "@/components/dashboard/dashboard-top-brands";
import { DashboardTrendCard } from "@/components/dashboard/dashboard-trend-card";
import { YouTubeHeroWidget } from "@/components/dashboard/youtube-hero-widget";
import { getDashboardOverview } from "@/lib/data/dashboard";
import { getLatestYoutubeStats } from "@/lib/data/fetchers";
import { getGoogleConnectionStatus } from "@/lib/google-auth";
import { getInboxDashboardSummary } from "@/lib/data/inbox";
import { canAccessInbox } from "@/lib/inbox-access";
import { requireUserId } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

type PageProps = { searchParams?: Promise<{ google?: string }> };

export default async function DashboardPage({ searchParams }: PageProps) {
  const sp = (await searchParams) ?? {};
  const year = new Date().getFullYear();
  const userId = await requireUserId();
  const [overview, yt, google, inbox] = await Promise.all([
    getDashboardOverview(),
    getLatestYoutubeStats(),
    getGoogleConnectionStatus(userId),
    canAccessInbox(userId) ? getInboxDashboardSummary() : Promise.resolve(null),
  ]);

  return (
    <div className="space-y-8">
      <DashboardHeader
        title="Dashboard"
        description="Cosa fare oggi, andamento del mese e pipeline — dati dal tuo CRM."
      />

      <div className="ui-enter space-y-8">
        <DashboardPriorityGrid data={overview.priorities} inbox={inbox} />
        <DashboardMonthSummary data={overview.month} />
        <section className="space-y-3">
          <h2 className="text-sm font-semibold tracking-tight text-gray-900">Andamento</h2>
          <div className="grid gap-4 lg:grid-cols-2">
            <DashboardTrendCard points={overview.trend12m} />
            <DashboardTopBrands brands={overview.topBrands} year={year} />
          </div>
        </section>
        <section className="space-y-3">
          <h2 className="text-sm font-semibold tracking-tight text-gray-900">YouTube</h2>
          <YouTubeHeroWidget initial={yt} google={google} oauthResult={sp.google ?? null} />
        </section>
      </div>
    </div>
  );
}
