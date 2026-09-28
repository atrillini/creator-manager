export type KanbanStatus =
  | "nuove"
  | "in_trattativa"
  | "accettate"
  | "completate"
  | "rifiutate";

export const KANBAN_COLUMNS: { id: KanbanStatus; title: string }[] = [
  { id: "nuove", title: "Nuove" },
  { id: "in_trattativa", title: "In trattativa" },
  { id: "accettate", title: "Accettate" },
  { id: "completate", title: "Completate" },
];

/** Colonna mostrata solo con l'interruttore "Mostra rifiutate". */
export const REJECTED_KANBAN_COLUMN: { id: KanbanStatus; title: string } = {
  id: "rifiutate",
  title: "Rifiutate",
};

export type KanbanCollaboration = {
  id: string;
  title: string;
  brandName: string;
  agreedFee: string | null;
  isGiveaway?: boolean;
  giveawayValue?: string | null;
  kanbanStatus: KanbanStatus;
};

/** Mappa `collaborations.status` del DB al board Kanban. */
export function mapStatusToKanban(status: string): KanbanStatus {
  switch (status) {
    case "in valutazione":
      return "in_trattativa";
    case "accettata":
      return "accettate";
    case "completata":
      return "completate";
    case "rifiutata":
      return "rifiutate";
    case "proposta":
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
  | "completata"
  | "rifiutata" {
  switch (col) {
    case "nuove":
      return "proposta";
    case "in_trattativa":
      return "in valutazione";
    case "accettate":
      return "accettata";
    case "completate":
      return "completata";
    case "rifiutate":
      return "rifiutata";
  }
}
