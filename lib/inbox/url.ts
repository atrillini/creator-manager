/** Parametri URL della pagina Inbox (filtri + thread aperto). */
export type InboxParams = {
  view?: string;
  cat?: string;
  brand?: string;
  tag?: string;
  unlinked?: string;
  q?: string;
  before?: string;
  t?: string;
};

const KEYS: (keyof InboxParams)[] = ["view", "cat", "brand", "tag", "unlinked", "q", "before", "t"];

/** Nuovo URL /inbox partendo dai parametri correnti; `null` rimuove la chiave. */
export function inboxHref(current: InboxParams, patch: Partial<Record<keyof InboxParams, string | null>>) {
  const sp = new URLSearchParams();
  for (const k of KEYS) {
    const v = k in patch ? patch[k] : current[k];
    if (v) sp.set(k, v);
  }
  const qs = sp.toString();
  return qs ? `/inbox?${qs}` : "/inbox";
}
