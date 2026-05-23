import {
  formatDashboardEur,
  type DashboardOverview,
} from "@/lib/data/dashboard";
import { DashboardStatLink } from "@/components/dashboard/dashboard-stat-link";
import { Euro, ListTodo, TrendingUp } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type Props = { data: DashboardOverview["month"] };

export function DashboardMonthSummary({ data }: Props) {
  const mom =
    data.earningsMomPct == null
      ? null
      : `${data.earningsMomPct >= 0 ? "+" : ""}${data.earningsMomPct}% vs mese scorso`;

  return (
    <section className="space-y-3">
      <h2 className="text-sm font-semibold tracking-tight text-gray-900">Questo mese</h2>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <DashboardStatLink
          href="/finanze"
          title="Entrate mese"
          icon={Euro}
          value={formatDashboardEur(data.earnings)}
          subtitle={mom ?? "Sponsor incassati + YouTube"}
        />

        <Card className="rounded-2xl border-gray-100 shadow-[0_2px_12px_rgba(0,0,0,0.04)]">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 p-4">
            <CardTitle className="text-xs font-medium text-gray-500">Pipeline forecast</CardTitle>
            <TrendingUp className="size-4 text-blue-500" />
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="space-y-2">
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-xs text-gray-500">Certo</span>
                <span className="text-lg font-bold tabular-nums text-gray-900">
                  {formatDashboardEur(data.pipelineCertain)}
                </span>
              </div>
              <p className="text-[11px] text-gray-400">Accettate, ancora da incassare</p>
              <div className="flex items-baseline justify-between gap-2 border-t border-gray-100 pt-2">
                <span className="text-xs text-gray-500">Probabile</span>
                <span className="text-lg font-semibold tabular-nums text-gray-800">
                  {formatDashboardEur(data.pipelineProbable)}
                </span>
              </div>
              <p className="text-[11px] text-gray-400">In valutazione</p>
            </div>
          </CardContent>
        </Card>

        <DashboardStatLink
          href="/collaborazioni?range=current_year"
          title="Deal aperti"
          icon={ListTodo}
          value={String(data.openDeals)}
          subtitle="Non completati / rifiutati"
        >
          <div className="flex flex-wrap gap-1.5 text-[11px] text-gray-600">
            <span className="rounded-full bg-gray-100 px-2 py-0.5">
              Proposta {data.openByStatus.proposta}
            </span>
            <span className="rounded-full bg-gray-100 px-2 py-0.5">
              Valutazione {data.openByStatus.inValutazione}
            </span>
            <span className="rounded-full bg-gray-100 px-2 py-0.5">
              Accettate {data.openByStatus.accettata}
            </span>
          </div>
        </DashboardStatLink>
      </div>
    </section>
  );
}
