export type KanbanStatus =
  | "nuove"
  | "in_trattativa"
  | "accettate"
  | "completate";

export const KANBAN_COLUMNS: { id: KanbanStatus; title: string }[] = [
  { id: "nuove", title: "Nuove" },
  { id: "in_trattativa", title: "In trattativa" },
  { id: "accettate", title: "Accettate" },
  { id: "completate", title: "Completate" },
];

/** Mappa `collaborations.status` del DB al board Kanban. */
export function mapStatusToKanban(
  status: string
):
  | "nuove"
  | "in_trattativa"
  | "accettate"
  | "completate" {
  switch (status) {
    case "in valutazione":
      return "in_trattativa";
    case "accettata":
      return "accettate";
    case "completata":
      return "completate";
    case "proposta":
    case "rifiutata":
    default:
      return "nuove";
  }
}

/** Colonna Kanban → valore `collaborations.status` in Supabase. */
export function mapKanbanToDbStatus(
  col: KanbanStatus
):
  | "proposta"
  | "in valutazione"
  | "accettata"
  | "completata" {
  switch (col) {
    case "nuove":
      return "proposta";
    case "in_trattativa":
      return "in valutazione";
    case "accettate":
      return "accettata";
    case "completate":
      return "completata";
  }
}
