import { BrandCollabPills } from "@/components/aziende/brand-collab-pills";
import { CreateBrandDialog } from "@/components/aziende/create-brand-dialog";
import { EditBrandDialog } from "@/components/aziende/edit-brand-dialog";
import { DashboardHeader } from "@/components/dashboard-header";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getAziendeTableBrands } from "@/lib/data/fetchers";

export default async function AziendePage() {
  const brands = await getAziendeTableBrands();

  return (
    <div>
      <DashboardHeader
        title="Aziende"
        description="Anagrafica brand: dati in Supabase; crea e riutilizza nelle collaborazioni."
        actions={<CreateBrandDialog />}
      />
      <div className="ui-enter overflow-hidden rounded-3xl bg-white shadow-[0_8px_30px_rgba(0,0,0,0.04)]">
        <Table>
          <TableHeader>
            <TableRow className="border-0 border-b border-gray-100/80">
              <TableHead className="text-gray-500">Nome</TableHead>
              <TableHead className="text-gray-500">Settore</TableHead>
              <TableHead className="min-w-[8rem] text-gray-500">
                Collaborazioni attive
              </TableHead>
              <TableHead className="min-w-[8rem] text-gray-500">
                Collaborazioni passate
              </TableHead>
              <TableHead className="w-[1%] text-right text-gray-500">
                <span className="sr-only">Azioni</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {brands.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={5}
                  className="py-10 text-center text-sm text-muted-foreground"
                >
                  Nessun brand. Usa &ldquo;Aggiungi azienda&rdquo; per inserirne
                  uno.
                </TableCell>
              </TableRow>
            )}
            {brands.map((b) => (
              <TableRow key={b.id} className="border-0 border-b border-gray-50/90">
                <TableCell className="font-medium text-gray-900">{b.name}</TableCell>
                <TableCell className="text-gray-600">{b.sector ?? "—"}</TableCell>
                <TableCell className="align-top text-sm text-gray-600">
                  <BrandCollabPills items={b.activeCollaborations} />
                </TableCell>
                <TableCell className="align-top text-sm text-gray-600">
                  <BrandCollabPills items={b.pastCollaborations} />
                </TableCell>
                <TableCell className="w-[1%] p-1 text-right align-top sm:p-2">
                  <div className="inline-flex">
                    <EditBrandDialog brand={b} />
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
