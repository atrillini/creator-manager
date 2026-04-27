import { createSupabaseClient } from "@/lib/supabase";
import { mapStatusToKanban } from "@/lib/types";
import * as mock from "./mock";

type CollabRow = {
  id: string;
  status: string;
  agreed_fee: number | string | null;
  brief_text: string | null;
  brands: { name: string } | { name: string }[] | null;
};

function brandName(brand: CollabRow["brands"]): string {
  if (!brand) return "Brand";
  if (Array.isArray(brand)) return brand[0]?.name ?? "Brand";
  return brand.name;
}

function feeString(v: number | string | null | undefined): string | null {
  if (v === null || v === undefined) return null;
  if (typeof v === "string") {
    if (v.trim() === "") return null;
    const n = Number(v);
    if (!Number.isNaN(n))
      return new Intl.NumberFormat("it-IT", {
        style: "currency",
        currency: "EUR",
      }).format(n);
    return v;
  }
  return new Intl.NumberFormat("it-IT", {
    style: "currency",
    currency: "EUR",
  }).format(v);
}

/** Prova Supabase, altrimenti dati fittizi (ID mock non hanno un record reale). */
export async function getCollaborations() {
  const supabase = createSupabaseClient();
  const { data, error } = await supabase
    .from("collaborations")
    .select("id, status, agreed_fee, brief_text, brands ( name )")
    .order("created_at", { ascending: false });

  if (error) {
    if (process.env.NODE_ENV === "development")
      console.warn("[CreatorCRM] collaborazioni:", error.message);
    return [];
  }
  if (!data?.length) {
    return [];
  }
  return data.map((row: unknown) => {
    const c = row as CollabRow;
    const s = c.status;
    return {
      id: c.id,
      title: c.brief_text?.trim() || "Senza titolo",
      brandName: brandName(c.brands),
      agreedFee: feeString(c.agreed_fee),
      kanbanStatus: mapStatusToKanban(s),
    };
  });
}

export type BrandRow = {
  id: string;
  name: string;
  sector: string | null;
  contacts: string | null;
  /** Rubrica strutturata (JSON), se la migration è applicata */
  contacts_json: unknown;
  notes: string | null;
};

export type BrandCollabLink = {
  id: string;
  /** Titolo breve (brief) per la pillola */
  title: string;
};

/** Riga brand per tab Aziende: include collaborazioni attive / completate. */
export type AziendeBrandRow = BrandRow & {
  activeCollaborations: BrandCollabLink[];
  pastCollaborations: BrandCollabLink[];
};

export async function getBrands(): Promise<BrandRow[]> {
  const supabase = createSupabaseClient();
  const { data, error } = await supabase
    .from("brands")
    .select("id, name, sector, contacts, contacts_json, notes")
    .order("name", { ascending: true });
  if (error) {
    if (process.env.NODE_ENV === "development")
      console.warn("[CreatorCRM] brands:", error.message);
    return [];
  }
  return (data as BrandRow[]) ?? [];
}

const COMPLETATA = "completata";

/**
 * Brand per la tab Aziende con elenco collaborazioni: attive = tutto tranne
 * `completata`; passate = solo `completata`. Ordinamento per `created_at` decrescente.
 */
export async function getAziendeTableBrands(): Promise<AziendeBrandRow[]> {
  const supabase = createSupabaseClient();
  const { data: brands, error: brandsError } = await supabase
    .from("brands")
    .select("id, name, sector, contacts, contacts_json, notes")
    .order("name", { ascending: true });

  if (brandsError) {
    if (process.env.NODE_ENV === "development")
      console.warn("[CreatorCRM] brands (aziende):", brandsError.message);
    return [];
  }
  if (!brands?.length) {
    return [];
  }

  const { data: collabs, error: collabsError } = await supabase
    .from("collaborations")
    .select("id, brand_id, status, brief_text, created_at")
    .order("created_at", { ascending: false });

  if (collabsError && process.env.NODE_ENV === "development") {
    console.warn("[CreatorCRM] collaborations (aziende):", collabsError.message);
  }

  const byBrand = new Map<
    string,
    { active: BrandCollabLink[]; past: BrandCollabLink[] }
  >();
  for (const b of brands) {
    byBrand.set(b.id, { active: [], past: [] });
  }

  for (const row of (collabs ?? []) as {
    id: string;
    brand_id: string;
    status: string;
    brief_text: string | null;
  }[]) {
    if (!row.brand_id) continue;
    const slot = byBrand.get(row.brand_id);
    if (!slot) continue;
    const title = row.brief_text?.trim() || "Senza titolo";
    const item: BrandCollabLink = { id: row.id, title };
    if (row.status === COMPLETATA) {
      slot.past.push(item);
    } else {
      slot.active.push(item);
    }
  }

  return (brands as BrandRow[]).map((b) => {
    const c = byBrand.get(b.id) ?? { active: [], past: [] };
    return {
      ...b,
      activeCollaborations: c.active,
      pastCollaborations: c.past,
    };
  });
}

export async function getDashboardStats() {
  const _s = createSupabaseClient();
  void _s;
  return mock.getMockDashboardStats();
}

export async function getFinancials() {
  const _s = createSupabaseClient();
  void _s;
  return mock.getMockFinancials();
}
