import { DashboardHeader } from "@/components/dashboard-header";
import { FinanzeRangeControls } from "@/components/finanze/finanze-range-controls";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  getFinancialSplitData,
  getFinancialsByRange,
  getRecentCollaborationPayments,
  type DateRange,
} from "@/lib/data/fetchers";

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("it-IT", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(amount);
}

function labelMonth(k: string) {
  const [y, m] = k.split("-");
  if (!y || !m) return k;
  const d = new Date(Number(y), Number(m) - 1, 1);
  return d.toLocaleDateString("it-IT", { month: "short", year: "2-digit" });
}

type PageProps = {
  searchParams?: Promise<{
    startDate?: string;
    endDate?: string;
  }>;
};

export default async function FinanzePage({ searchParams }: PageProps) {
  const sp = (await searchParams) ?? {};
  const now = new Date();
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(
    now.getDate()
  ).padStart(2, "0")}`;
  const yearStart = `${now.getFullYear()}-01-01`;
  const range: DateRange = {
    startDate: sp.startDate ?? yearStart,
    endDate: sp.endDate ?? today,
  };
  const [rows, split, paymentAudit] = await Promise.all([
    getFinancialsByRange(range),
    getFinancialSplitData(range),
    getRecentCollaborationPayments(range),
  ]);

  return (
    <div>
      <DashboardHeader
        title="Finanze"
        description="Split view tra ricavi YouTube e Collaborazioni, con aggregazione totale."
        end={
          <FinanzeRangeControls
            initialStartDate={range.startDate}
            initialEndDate={range.endDate}
          />
        }
      />
      <div className="ui-stagger mb-4 grid gap-4 lg:grid-cols-3">
        <section className="rounded-3xl bg-white p-5 shadow-[0_8px_30px_rgba(0,0,0,0.04)]">
          <p className="text-xs uppercase tracking-wide text-gray-400">YouTube Revenue</p>
          <p className="mt-1 text-3xl font-bold tabular-nums text-gray-900">
            {formatCurrency(split.youtubeTotal)}
          </p>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {split.youtubeTrend.length === 0 ? (
              <span className="text-xs text-gray-400">Nessun trend disponibile</span>
            ) : (
              split.youtubeTrend.map((x) => (
                <Badge key={x.month} variant="muted" className="bg-gray-100 text-gray-700">
                  {labelMonth(x.month)} {formatCurrency(x.amount)}
                </Badge>
              ))
            )}
          </div>
        </section>

        <section className="rounded-3xl bg-white p-5 shadow-[0_8px_30px_rgba(0,0,0,0.04)]">
          <p className="text-xs uppercase tracking-wide text-gray-400">Collaborazioni Revenue</p>
          <p className="mt-1 text-3xl font-bold tabular-nums text-gray-900">
            {formatCurrency(split.sponsorTotal)}
          </p>
          <p className="mt-1 text-[11px] text-gray-500">
            Include Entrata Sponsor + collaborazioni con pagamento registrato.
          </p>
          <div className="mt-2 rounded-xl bg-gray-50 px-2.5 py-2">
            <p className="text-[11px] text-gray-500">
              Forecast vs Actual: incassato {split.sponsorActualPct}% del contrattualizzato
            </p>
            <p className="text-[11px] font-medium text-gray-700">
              {formatCurrency(split.sponsorTotal)} / {formatCurrency(split.sponsorForecastTotal)}
            </p>
          </div>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {split.sponsorTrend.length === 0 ? (
              <span className="text-xs text-gray-400">Nessun trend disponibile</span>
            ) : (
              split.sponsorTrend.map((x) => (
                <Badge key={x.month} variant="muted" className="bg-gray-100 text-gray-700">
                  {labelMonth(x.month)} {formatCurrency(x.amount)}
                </Badge>
              ))
            )}
          </div>
        </section>

        <section className="rounded-3xl bg-white p-5 shadow-[0_8px_30px_rgba(0,0,0,0.04)]">
          <p className="text-xs uppercase tracking-wide text-gray-400">Total Revenue</p>
          <p className="mt-1 text-3xl font-bold tabular-nums text-gray-900">
            {formatCurrency(split.overallTotal)}
          </p>
          <div className="mt-3 h-3 overflow-hidden rounded-full bg-gray-100">
            <div className="h-full bg-blue-500" style={{ width: `${split.youtubePct}%` }} />
          </div>
          <div className="mt-2 flex items-center justify-between text-xs text-gray-500">
            <span>YouTube {split.youtubePct}%</span>
            <span>Collaborazioni {split.sponsorPct}%</span>
          </div>
        </section>
      </div>
      <div className="ui-enter overflow-hidden rounded-3xl bg-white shadow-[0_8px_30px_rgba(0,0,0,0.04)]">
        <Table>
          <TableHeader>
            <TableRow className="border-0 border-b border-gray-100/80">
              <TableHead className="text-gray-500">Data</TableHead>
              <TableHead className="text-gray-500">Tipo</TableHead>
              <TableHead className="text-gray-500">Importo</TableHead>
              <TableHead className="text-gray-500">Collaborazione</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.id} className="border-0 border-b border-gray-50/90">
                <TableCell className="whitespace-nowrap text-gray-500">
                  {r.date}
                </TableCell>
                <TableCell className="text-gray-800">{r.type}</TableCell>
                <TableCell className="font-mono text-sm font-medium text-gray-900">
                  {r.amount}
                </TableCell>
                <TableCell className="max-w-sm truncate text-gray-500">
                  {r.collaboration ?? "—"}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <div className="ui-enter mt-4 overflow-hidden rounded-3xl bg-white shadow-[0_8px_30px_rgba(0,0,0,0.04)]">
        <div className="border-b border-gray-100/80 px-4 py-3">
          <p className="text-sm font-medium text-gray-900">Pagamenti collaborazione (audit)</p>
        </div>
        <Table>
          <TableHeader>
            <TableRow className="border-0 border-b border-gray-100/80">
              <TableHead className="text-gray-500">Data</TableHead>
              <TableHead className="text-gray-500">Collaborazione</TableHead>
              <TableHead className="text-gray-500">Importo</TableHead>
              <TableHead className="text-gray-500">Nota</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paymentAudit.map((r) => (
              <TableRow key={r.id} className="border-0 border-b border-gray-50/90">
                <TableCell className="whitespace-nowrap text-gray-500">{r.date}</TableCell>
                <TableCell className="text-gray-800">{r.collaboration}</TableCell>
                <TableCell className="font-mono text-sm font-medium text-gray-900">
                  {r.amount}
                </TableCell>
                <TableCell className="text-gray-500">{r.note ?? "—"}</TableCell>
              </TableRow>
            ))}
            {paymentAudit.length === 0 && (
              <TableRow>
                <TableCell colSpan={4} className="py-6 text-center text-sm text-gray-400">
                  Nessun pagamento collaborazione nel range selezionato.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
