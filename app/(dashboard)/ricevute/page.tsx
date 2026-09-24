import { DashboardHeader } from "@/components/dashboard-header";
import { ReceiptsTable } from "@/components/ricevute/receipts-table";
import { ReceiptsToolbar } from "@/components/ricevute/receipts-toolbar";
import { getReceiptFormOptions, getReceiptYears, getReceipts } from "@/lib/data/receipts";
import { isValidUuid } from "@/lib/is-uuid";
import { OCCASIONAL_WORK_THRESHOLD } from "@/lib/receipts/model";
import { cn } from "@/lib/utils";
import Link from "next/link";

const eur = (n: number) =>
  new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" }).format(n);

type PageProps = {
  searchParams?: Promise<{ anno?: string; collaborazione?: string }>;
};

export default async function RicevutePage({ searchParams }: PageProps) {
  const sp = (await searchParams) ?? {};
  const currentYear = new Date().getFullYear();
  const parsedYear = Number(sp.anno);
  const year = Number.isInteger(parsedYear) && parsedYear > 2000 ? parsedYear : currentYear;
  const autoOpenCollaborationId =
    sp.collaborazione && isValidUuid(sp.collaborazione) ? sp.collaborazione : null;

  const [receipts, years, options] = await Promise.all([
    getReceipts({ year }),
    getReceiptYears(),
    getReceiptFormOptions(),
  ]);
  if (!years.includes(year)) years.push(year);
  years.sort((a, b) => b - a);

  const valid = receipts.filter((r) => r.status !== "annullata");
  const issuedGross = valid.reduce((acc, r) => acc + r.gross, 0);
  const collected = valid.filter((r) => r.status === "pagata").reduce((acc, r) => acc + r.net, 0);
  const outstanding = valid.filter((r) => r.status === "emessa");
  const outstandingTotal = outstanding.reduce((acc, r) => acc + r.net, 0);
  const thresholdPct = Math.min(100, Math.round((issuedGross / OCCASIONAL_WORK_THRESHOLD) * 100));

  return (
    <div>
      <DashboardHeader
        title="Ricevute"
        description="Ricevute per prestazione occasionale: emissione, PDF da inviare ai brand e registro di quanto emesso."
        end={<ReceiptsToolbar options={options} autoOpenCollaborationId={autoOpenCollaborationId} />}
      />

      <div className="mb-4 flex flex-wrap gap-1.5">
        {years.map((y) => (
          <Link
            key={y}
            href={y === currentYear ? "/ricevute" : `/ricevute?anno=${y}`}
            className={cn(
              "rounded-full px-3 py-1 text-sm transition-colors",
              y === year ? "bg-gray-900 text-white" : "bg-white text-gray-600 hover:bg-gray-100"
            )}
          >
            {y}
          </Link>
        ))}
      </div>

      <div className="ui-stagger mb-4 grid gap-4 md:grid-cols-3">
        <section className="rounded-3xl bg-white p-5 shadow-[0_8px_30px_rgba(0,0,0,0.04)]">
          <p className="text-xs uppercase tracking-wide text-gray-400">Emesso {year} (lordo)</p>
          <p className="mt-1 text-3xl font-bold tabular-nums text-gray-900">{eur(issuedGross)}</p>
          <p className="mt-1 text-xs text-gray-500">
            {valid.length} ricevut{valid.length === 1 ? "a" : "e"} valid{valid.length === 1 ? "a" : "e"}
          </p>
        </section>
        <section className="rounded-3xl bg-white p-5 shadow-[0_8px_30px_rgba(0,0,0,0.04)]">
          <p className="text-xs uppercase tracking-wide text-gray-400">Incassato / da incassare</p>
          <p className="mt-1 text-3xl font-bold tabular-nums text-gray-900">{eur(collected)}</p>
          <p className={cn("mt-1 text-xs", outstanding.length ? "text-amber-700" : "text-gray-500")}>
            {outstanding.length
              ? `${eur(outstandingTotal)} in attesa su ${outstanding.length} ricevut${outstanding.length === 1 ? "a" : "e"}`
              : "Nessuna ricevuta in attesa"}
          </p>
        </section>
        <section className="rounded-3xl bg-white p-5 shadow-[0_8px_30px_rgba(0,0,0,0.04)]">
          <p className="text-xs uppercase tracking-wide text-gray-400">Soglia prestazione occasionale</p>
          <p className="mt-1 text-3xl font-bold tabular-nums text-gray-900">
            {eur(Math.max(0, OCCASIONAL_WORK_THRESHOLD - issuedGross))}
          </p>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-gray-100">
            <div
              className={cn("h-full", thresholdPct >= 100 ? "bg-red-500" : thresholdPct >= 80 ? "bg-amber-500" : "bg-blue-500")}
              style={{ width: `${thresholdPct}%` }}
            />
          </div>
          <p className="mt-1.5 text-[11px] text-gray-500">
            Residuo prima di {eur(OCCASIONAL_WORK_THRESHOLD)} lordi annui: oltre, contributi INPS Gestione Separata.
          </p>
        </section>
      </div>

      <ReceiptsTable receipts={receipts} options={options} />
    </div>
  );
}
