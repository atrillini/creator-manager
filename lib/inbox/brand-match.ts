import type { SupabaseClient } from "@supabase/supabase-js";
import { parseContactsJson } from "@/lib/brand-contacts";
import { GENERIC_EMAIL_DOMAINS, emailDomain } from "@/lib/inbox/constants";

export type BrandMatcher = {
  /** Brand dai mittenti: prima email esatta dei referenti, poi dominio (esclusi i domini generici). */
  match: (emails: string[]) => string | null;
  brands: { id: string; name: string; domains: string[] }[];
};

export async function loadBrandMatcher(supabase: SupabaseClient, userId: string): Promise<BrandMatcher> {
  const { data } = await supabase
    .from("brands")
    .select("id, name, contacts_json, email_domains")
    .eq("user_id", userId);
  const byEmail = new Map<string, string>();
  const byDomain = new Map<string, string>();
  const brands: BrandMatcher["brands"] = [];
  for (const b of (data ?? []) as {
    id: string;
    name: string;
    contacts_json: unknown;
    email_domains: string[] | null;
  }[]) {
    const domains = new Set((b.email_domains ?? []).map((d) => d.trim().toLowerCase()).filter(Boolean));
    for (const c of parseContactsJson(b.contacts_json)) {
      const email = c.email.trim().toLowerCase();
      if (!email) continue;
      byEmail.set(email, b.id);
      const d = emailDomain(email);
      if (d && !GENERIC_EMAIL_DOMAINS.has(d)) domains.add(d);
    }
    for (const d of domains) if (!byDomain.has(d)) byDomain.set(d, b.id);
    brands.push({ id: b.id, name: b.name, domains: [...domains] });
  }
  return {
    brands,
    match(emails) {
      for (const e of emails) {
        const hit = byEmail.get(e.toLowerCase());
        if (hit) return hit;
      }
      for (const e of emails) {
        const d = emailDomain(e);
        if (d && !GENERIC_EMAIL_DOMAINS.has(d)) {
          const hit = byDomain.get(d);
          if (hit) return hit;
        }
      }
      return null;
    },
  };
}
