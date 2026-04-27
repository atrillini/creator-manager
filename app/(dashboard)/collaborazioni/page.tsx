import { CreateCollaborationDialog } from "@/components/collaborazioni/create-collaboration-dialog";
import { CollaborationKanban } from "@/components/collaboration-kanban";
import { DashboardHeader } from "@/components/dashboard-header";
import { getBrands, getCollaborations } from "@/lib/data/fetchers";

export default async function CollaborazioniPage() {
  const [collaborations, brandRows] = await Promise.all([
    getCollaborations(),
    getBrands(),
  ]);
  const brandOptions = brandRows.map((b) => ({ id: b.id, name: b.name }));

  return (
    <div className="flex min-h-0 flex-col">
      <DashboardHeader
        title="Collaborazioni"
        description="Pipeline in stile Kanban: dalle proposte ai progetti completati (dati da Supabase)."
        actions={
          <CreateCollaborationDialog brands={brandOptions} />
        }
      />
      {collaborations.length === 0 && (
        <p className="mb-3 text-sm text-muted-foreground">
          Nessun deal: crea un&rsquo;azienda sotto Aziende, poi usa
          &ldquo;Nuova collaborazione&rdquo;.
        </p>
      )}
      <CollaborationKanban collaborations={collaborations} />
    </div>
  );
}
