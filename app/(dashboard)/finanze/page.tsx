import { DashboardHeader } from "@/components/dashboard-header";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getFinancials } from "@/lib/data/fetchers";

export default async function FinanzePage() {
  const rows = await getFinancials();

  return (
    <div>
      <DashboardHeader
        title="Finanze"
        description="Entrate e uscite. Collega la tabella financials quando l’API è pronta."
      />
      <div className="overflow-hidden rounded-3xl bg-white shadow-[0_8px_30px_rgba(0,0,0,0.04)]">
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
    </div>
  );
}
