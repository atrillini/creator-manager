import { CollaborationWorkspace } from "@/components/collaboration/collaboration-workspace";
import { getCollaborationDetail } from "@/lib/data/collaboration-detail";
import { getBrands } from "@/lib/data/fetchers";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { notFound } from "next/navigation";

type PageProps = { params: Promise<{ id: string }> };

function mergeBrandOptions(
  detail: { brand: { id: string; name: string } | null },
  fromDb: { id: string; name: string }[]
) {
  const m = new Map(
    fromDb.map((b) => [b.id, { id: b.id, name: b.name } as const])
  );
  if (detail.brand && !m.has(detail.brand.id)) {
    m.set(detail.brand.id, {
      id: detail.brand.id,
      name: detail.brand.name,
    });
  }
  return [...m.values()].sort((a, b) =>
    a.name.localeCompare(b.name, "it", { sensitivity: "base" })
  );
}

export default async function CollaborationDetailPage({ params }: PageProps) {
  const { id } = await params;
  const [result, allBrands] = await Promise.all([
    getCollaborationDetail(id),
    getBrands(),
  ]);

  if (!result.ok) {
    if (result.notFound) {
      notFound();
    }
    return (
    <div className="mx-auto max-w-lg rounded-xl border border-border bg-card p-6 text-center shadow-sm">
      <h1 className="text-lg font-semibold">Impossibile caricare</h1>
      <p className="mt-2 text-sm text-muted-foreground">{result.message}</p>
      <p className="mt-1 text-xs text-muted-foreground">
        Verifica la migration Supabase, le variabili d’ambiente e le policy RLS.
      </p>
      <Button asChild className="mt-4" variant="outline" size="sm">
        <Link href="/collaborazioni">Torna a Collaborazioni</Link>
      </Button>
    </div>
    );
  }

  return (
    <CollaborationWorkspace
      key={result.data.id}
      data={result.data}
      brandOptions={mergeBrandOptions(result.data, allBrands)}
    />
  );
}
