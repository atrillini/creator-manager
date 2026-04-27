export const DELIVERABLE_STATUS_VALUES = [
  "da girare",
  "girato",
  "in montaggio",
  "approvazione cliente",
  "pubblicato",
] as const;

export type DeliverableWorkflowStatus =
  (typeof DELIVERABLE_STATUS_VALUES)[number];

export const DELIVERABLE_STATUS_OPTIONS: {
  value: DeliverableWorkflowStatus;
  label: string;
}[] = [
  { value: "da girare", label: "Da girare" },
  { value: "girato", label: "Girato (riprese ok)" },
  { value: "in montaggio", label: "In montaggio" },
  { value: "approvazione cliente", label: "Approvazione cliente" },
  { value: "pubblicato", label: "Pubblicato" },
];

export function isDeliverableWorkflowStatus(
  v: string
): v is DeliverableWorkflowStatus {
  return (DELIVERABLE_STATUS_VALUES as readonly string[]).includes(v);
}
