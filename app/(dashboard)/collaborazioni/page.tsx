import { CollaborazioniActions } from "@/components/collaborazioni/collaborazioni-actions";
import { CollaborazioniFilters } from "@/components/collaborazioni/collaborazioni-filters";
import { CollaborationKanban } from "@/components/collaboration-kanban";
import { DashboardHeader } from "@/components/dashboard-header";
import { getBrands, getCollaborations } from "@/lib/data/fetchers";

type RangePreset = "current_year" | "prev_year" | "last90" | "all" | "custom";

function parseRange(raw: string | undefined): RangePreset {
  if (raw === "prev_year" || raw === "last90" || raw === "all" || raw === "custom") {
    return raw;
  }
  return "current_year";
}

function toYmd(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
}

function resolveRange(
  range: RangePreset,
  fromParam: string | undefined,
  toParam: string | undefined
): { startDate?: string; endDate?: string } {
  const now = new Date();
  const y = now.getFullYear();
  switch (range) {
    case "all":
      return {};
    case "prev_year":
      return { startDate: `${y - 1}-01-01`, endDate: `${y - 1}-12-31` };
    case "last90": {
      const end = now;
      const start = new Date(end);
      start.setDate(end.getDate() - 89);
      return { startDate: toYmd(start), endDate: toYmd(end) };
    }
    case "custom":
      return {
        startDate: fromParam || undefined,
        endDate: toParam || undefined,
      };
    case "current_year":
    default:
      return { startDate: `${y}-01-01`, endDate: `${y}-12-31` };
  }
}

type PageProps = {
  searchParams?: Promise<{
    range?: string;
    from?: string;
    to?: string;
    q?: string;
  }>;
};

export default async function CollaborazioniPage({ searchParams }: PageProps) {
  const sp = (await searchParams) ?? {};
  const range = parseRange(sp.range);
  const { startDate, endDate } = resolveRange(range, sp.from, sp.to);
  const query = (sp.q ?? "").trim();

  const [collabResult, brandRows] = await Promise.all([
    getCollaborations({ startDate, endDate, query }),
    getBrands(),
  ]);
  const brandOptions = brandRows.map((b) => ({ id: b.id, name: b.name }));

  return (
    <div className="flex min-h-0 flex-col">
      <DashboardHeader
        title="Collaborazioni"
        description="Pipeline in stile Kanban: dalle proposte ai progetti completati (dati da Supabase)."
        actions={<CollaborazioniActions brands={brandOptions} />}
      />
      <CollaborazioniFilters
        filteredCount={collabResult.items.length}
        totalCount={collabResult.totalCount}
      />
      {collabResult.items.length === 0 && (
        <p className="mb-3 text-sm text-muted-foreground">
          {collabResult.totalCount === 0
            ? "Nessun deal: crea un’azienda sotto Aziende, poi usa “Nuova collaborazione”."
            : "Nessuna collaborazione corrisponde ai filtri impostati."}
        </p>
      )}
      <div className="ui-enter">
        <CollaborationKanban collaborations={collabResult.items} />
      </div>
    </div>
  );
}
