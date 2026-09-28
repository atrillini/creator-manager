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
      {/* Telefono: una card per azienda */}
      <ul className="ui-enter space-y-2 md:hidden">
        {brands.length === 0 && (
          <li className="rounded-3xl bg-white py-10 text-center text-sm text-muted-foreground">
            Nessun brand. Usa &ldquo;Aggiungi azienda&rdquo; per inserirne uno.
          </li>
        )}
        {brands.map((b) => (
          <li key={b.id} className="rounded-3xl bg-white p-4 shadow-[0_8px_30px_rgba(0,0,0,0.04)]">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate font-medium text-gray-900">{b.name}</p>
                <p className="text-xs text-gray-500">{b.sector ?? "Settore non indicato"}</p>
              </div>
              <EditBrandDialog brand={b} />
            </div>
            {b.activeCollaborations.length > 0 ? (
              <div className="mt-2">
                <p className="mb-1 text-[11px] font-medium uppercase tracking-wide text-gray-400">Attive</p>
                <BrandCollabPills items={b.activeCollaborations} />
              </div>
            ) : null}
            {b.pastCollaborations.length > 0 ? (
              <div className="mt-2">
                <p className="mb-1 text-[11px] font-medium uppercase tracking-wide text-gray-400">Passate</p>
                <BrandCollabPills items={b.pastCollaborations} />
              </div>
            ) : null}
          </li>
        ))}
      </ul>

      <div className="ui-enter overflow-hidden rounded-3xl bg-white shadow-[0_8px_30px_rgba(0,0,0,0.04)] max-md:hidden">
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
