import {
  formatDashboardEur,
  type DashboardOverview,
} from "@/lib/data/dashboard";
import { DashboardStatLink } from "@/components/dashboard/dashboard-stat-link";
import { Calendar, Clock, Gift, Wallet } from "lucide-react";
import Link from "next/link";

type Props = { data: DashboardOverview["priorities"] };

function formatShortDate(iso: string) {
  return new Date(iso + "T12:00:00").toLocaleDateString("it-IT", {
    day: "numeric",
    month: "short",
  });
}

export function DashboardPriorityGrid({ data }: Props) {
  return (
    <section className="space-y-3">
      <h2 className="text-sm font-semibold tracking-tight text-gray-900">Da fare oggi</h2>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <DashboardStatLink
          href="/calendario"
          title="Scadenze (7 giorni)"
          icon={Calendar}
          value={String(data.deadlines7d.count)}
          subtitle="Contenuti da pubblicare"
        >
          {data.deadlines7d.items.length > 0 ? (
            <ul className="space-y-1.5">
              {data.deadlines7d.items.map((d) => (
                <li key={d.id} className="text-xs text-gray-600">
                  <span className="font-medium text-gray-800">{formatShortDate(d.publishDate)}</span>
                  {" · "}
                  <span className="line-clamp-1">{d.title}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-gray-400">Nessuna scadenza imminente.</p>
          )}
        </DashboardStatLink>

        <DashboardStatLink
          href="/collaborazioni?range=all"
          title="In attesa risposta"
          icon={Clock}
          value={String(data.staleResponse.count)}
          subtitle="Ferme da oltre 7 giorni"
        >
          {data.staleResponse.items.length > 0 ? (
            <ul className="space-y-1.5">
              {data.staleResponse.items.map((s) => (
                <li key={s.id}>
                  <Link
                    href={`/collaborations/${s.id}`}
                    className="block text-xs text-gray-600 hover:text-blue-600"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <span className="font-medium text-gray-800">{s.brandName}</span>
                    {" · "}
                    {s.daysStale}g · {s.status}
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-gray-400">Nessuna trattativa in stallo.</p>
          )}
        </DashboardStatLink>

        <DashboardStatLink
          href="/finanze"
          title="Pagamenti da recuperare"
          icon={Wallet}
          value={String(data.overduePayments.count)}
          subtitle={
            data.overduePayments.totalRemaining > 0
              ? `${formatDashboardEur(data.overduePayments.totalRemaining)} residui`
              : "Deal completati non saldati"
          }
        >
          {data.overduePayments.items.length > 0 ? (
            <ul className="space-y-1.5">
              {data.overduePayments.items.map((p) => (
                <li key={p.id}>
                  <Link
                    href={`/collaborations/${p.id}`}
                    className="flex justify-between gap-2 text-xs text-gray-600 hover:text-blue-600"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <span className="line-clamp-1">{p.title}</span>
                    <span className="shrink-0 font-medium tabular-nums text-gray-800">
                      {formatDashboardEur(p.remaining)}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-gray-400">Tutto saldato (o senza fee).</p>
          )}
        </DashboardStatLink>

        <DashboardStatLink
          href="/collaborazioni?range=all"
          title="Giveaway attivi"
          icon={Gift}
          value={String(data.activeGiveaways.count)}
          subtitle={
            data.activeGiveaways.estimatedValue > 0
              ? `Valore stimato ${formatDashboardEur(data.activeGiveaways.estimatedValue)}`
              : "Scambio prodotti in corso"
          }
        />
      </div>
    </section>
  );
}
