import type { LucideIcon } from "lucide-react";
import {
  Handshake,
  Mail,
  NotepadText,
  Paperclip,
  Phone,
} from "lucide-react";

export const EVENT_TYPES = [
  "email",
  "meeting",
  "trattativa",
  "file",
  "nota",
] as const;

export type EventType = (typeof EVENT_TYPES)[number];

const labels: Record<EventType, string> = {
  email: "Email",
  meeting: "Call / meeting",
  trattativa: "Trattativa",
  file: "File",
  nota: "Nota",
};

export const EVENT_TYPE_OPTIONS = EVENT_TYPES.map((value) => ({
  value,
  label: labels[value] ?? value,
}));

export const EVENT_TYPE_ICONS: Record<EventType, LucideIcon> = {
  email: Mail,
  meeting: Phone,
  trattativa: Handshake,
  file: Paperclip,
  nota: NotepadText,
};
