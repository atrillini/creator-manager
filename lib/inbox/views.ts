import { INBOX_STATUSES, type InboxStatus } from "@/lib/inbox/constants";

/** Viste della colonna sinistra (raggruppano gli stati). */
export const INBOX_VIEWS = {
  da_gestire: { label: "Da gestire", statuses: ["nuova", "da_rispondere"] as InboxStatus[] },
  in_attesa: { label: "In attesa del brand", statuses: ["in_attesa"] as InboxStatus[] },
  gestite: { label: "Gestite", statuses: ["gestita"] as InboxStatus[] },
  archiviate: { label: "Archiviate", statuses: ["archiviata"] as InboxStatus[] },
  tutte: { label: "Tutte", statuses: [...INBOX_STATUSES] as InboxStatus[] },
} as const;
export type InboxView = keyof typeof INBOX_VIEWS;

export function parseInboxView(v: string | undefined): InboxView {
  return v && v in INBOX_VIEWS ? (v as InboxView) : "da_gestire";
}
