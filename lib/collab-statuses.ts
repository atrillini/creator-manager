export const COLLAB_STATUSES = [
  "proposta",
  "in valutazione",
  "accettata",
  "rifiutata",
  "completata",
] as const;

export type CollabStatus = (typeof COLLAB_STATUSES)[number];

const labels: Record<CollabStatus, string> = {
  proposta: "Proposta",
  "in valutazione": "In valutazione",
  accettata: "Accettata",
  rifiutata: "Rifiutata",
  completata: "Completata",
};

export const COLLAB_STATUS_OPTIONS = COLLAB_STATUSES.map((s) => ({
  value: s,
  label: labels[s] ?? s,
}));
