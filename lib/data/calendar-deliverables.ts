import { createSupabaseClient } from "@/lib/supabase";

export type CalendarDeliverableItem = {
  id: string;
  collaborationId: string;
  type: string;
  status: string;
  /** ISO date YYYY-MM-DD */
  publishDate: string;
  brandName: string;
  /** es. "Reel IG - Dyson" */
  displayLabel: string;
  contentUrl: string | null;
};

type CollabJoin = {
  id: string;
  brands: { name: string } | { name: string }[] | null;
};

type RawRow = {
  id: string;
  type: string;
  status: string;
  publish_date: string;
  collaboration_id: string;
  content_url: string | null;
  collaborations: CollabJoin | CollabJoin[] | null;
};

function oneCollab(
  c: RawRow["collaborations"]
): CollabJoin | null {
  if (c == null) return null;
  return Array.isArray(c) ? c[0] ?? null : c;
}

function brandNameFromJoin(collab: CollabJoin | null): string {
  if (!collab?.brands) return "Azienda";
  const b = collab.brands;
  if (Array.isArray(b)) return b[0]?.name?.trim() || "Azienda";
  return b.name?.trim() || "Azienda";
}

/**
 * Deliverable con data di pubblicazione, join a collaborations e brands.
 */
export async function getDeliverableCalendarItems(): Promise<CalendarDeliverableItem[]> {
  const supabase = createSupabaseClient();
  const { data, error } = await supabase
    .from("deliverables")
    .select(
      "id, type, status, publish_date, content_url, collaboration_id, collaborations ( id, brands ( name ) )"
    )
    .not("publish_date", "is", null)
    .order("publish_date", { ascending: true });

  if (error) {
    if (process.env.NODE_ENV === "development") {
      console.warn("[CreatorCRM] deliverables calendario:", error.message);
    }
    return [];
  }
  if (!data?.length) {
    return [];
  }

  const rows = data as unknown as RawRow[];
  return rows.map((r) => {
    const join = oneCollab(r.collaborations);
    const brand = brandNameFromJoin(join);
    const collabId = join?.id ?? r.collaboration_id;
    const displayLabel = `${r.type} - ${brand}`;
    return {
      id: r.id,
      collaborationId: collabId,
      type: r.type,
      status: r.status,
      publishDate: r.publish_date,
      brandName: brand,
      displayLabel,
      contentUrl: r.content_url,
    } satisfies CalendarDeliverableItem;
  });
}
