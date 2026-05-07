"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useId, useMemo, useRef, useState, useTransition } from "react";
import { setCollaborationStatus } from "@/lib/actions/collaboration-status";
import { setCollaborationPaid } from "@/lib/actions/collaboration-payment";
import {
  addCollaborationPayment,
  deleteCollaborationPayment,
  updateCollaborationPayment,
} from "@/lib/actions/collaboration-payments";
import {
  addCollaborationEvent,
  addDeliverable,
  updateGeneralNotes,
} from "@/lib/actions/collaboration";
import { DeliverableRowEditor } from "@/components/collaboration/deliverable-row-editor";
import {
  DELIVERABLE_STATUS_OPTIONS,
  type DeliverableWorkflowStatus,
} from "@/lib/deliverable-statuses";
import { COLLAB_STATUS_OPTIONS } from "@/lib/collab-statuses";
import {
  EVENT_TYPE_ICONS,
  EVENT_TYPE_OPTIONS,
} from "@/lib/collab-event-types";
import { COLLAB_FILES_BUCKET, makeCollaborationObjectPath } from "@/lib/storage-constants";
import type {
  CollaborationDetail,
  CollaborationEventRow,
} from "@/lib/data/collaboration-detail";
import { supabase } from "@/lib/supabase";
import { DashboardHeader } from "@/components/dashboard-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { EditTimelineEventDialog } from "@/components/collaboration/edit-timeline-event-dialog";
import { EditCollaborationDialog } from "@/components/collaboration/edit-collaboration-dialog";
import type { BrandOption } from "@/components/collaborazioni/create-collaboration-dialog";
import {
  Activity,
  ArrowLeft,
  Building2,
  CalendarPlus,
  CheckCircle2,
  Download,
  Euro,
  Loader2,
  Pencil,
  PenLine,
  Trash2,
} from "lucide-react";
import Link from "next/link";
import type { EventType } from "@/lib/collab-event-types";

const deliverableTypes = ["Video YouTube", "Reel IG", "Story"] as const;

const formatEventDate = (iso: string) => {
  try {
    return new Date(iso).toLocaleString("it-IT", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
};

const URL_RE = /((?:https?:\/\/|www\.)[^\s<>"')\]]+)/gi;

function renderTextWithLinks(text: string | null | undefined) {
  const src = (text ?? "").trim();
  if (!src) return "—";
  const lines = src.split(/\r?\n/);
  return lines.map((line, lineIdx) => {
    const parts = line.split(URL_RE);
    return (
      <span key={`line-${lineIdx}`}>
        {parts.map((part, idx) => {
          if (!part) return null;
          if (/^(?:https?:\/\/|www\.)/i.test(part)) {
            const href = part.startsWith("http") ? part : `https://${part}`;
            return (
              <a
                key={`p-${lineIdx}-${idx}`}
                href={href}
                target="_blank"
                rel="noreferrer"
                className="text-blue-600 underline decoration-blue-300 underline-offset-2 hover:text-blue-700"
              >
                {part}
              </a>
            );
          }
          return <span key={`p-${lineIdx}-${idx}`}>{part}</span>;
        })}
        {lineIdx < lines.length - 1 ? <br /> : null}
      </span>
    );
  });
}

/** Valore per input `datetime-local` in fuso orario locale. */
function toLocalInputDateTimeValue(d: Date) {
  const t = d.getTime() - d.getTimezoneOffset() * 60_000;
  return new Date(t).toISOString().slice(0, 16);
}

type Props = { data: CollaborationDetail; brandOptions: BrandOption[] };

export function CollaborationWorkspace({ data, brandOptions }: Props) {
  const collab = data;
  const router = useRouter();
  const [pending, start] = useTransition();
  const formId = useId();

  const [notes, setNotes] = useState(collab.general_notes ?? "");
  const [notesState, setNotesState] = useState<
    "idle" | "saving" | "saved" | "err"
  >("idle");
  const [notesError, setNotesError] = useState<string | null>(null);
  const notesDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [eventType, setEventType] = useState<EventType>("nota");
  const [eventAt, setEventAt] = useState(() => toLocalInputDateTimeValue(new Date()));
  const [eventDesc, setEventDesc] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [statusLocal, setStatusLocal] = useState(collab.status);
  const [uploading, setUploading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [delivType, setDelivType] = useState<(typeof deliverableTypes)[number]>(
    "Reel IG"
  );
  const [delivDate, setDelivDate] = useState("");
  const [delivStatus, setDelivStatus] =
    useState<DeliverableWorkflowStatus>("da girare");
  const [delivContentUrl, setDelivContentUrl] = useState("");
  const [delivError, setDelivError] = useState<string | null>(null);
  const [editingEvent, setEditingEvent] = useState<CollaborationEventRow | null>(null);
  const [editCollabOpen, setEditCollabOpen] = useState(false);
  const [visibleEventsCount, setVisibleEventsCount] = useState(10);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentDate, setPaymentDate] = useState(() =>
    new Date().toISOString().slice(0, 10)
  );
  const [paymentNote, setPaymentNote] = useState("");
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [editingPaymentId, setEditingPaymentId] = useState<string | null>(null);
  const [editingPaymentAmount, setEditingPaymentAmount] = useState("");
  const [editingPaymentDate, setEditingPaymentDate] = useState("");
  const [editingPaymentNote, setEditingPaymentNote] = useState("");

  const flushSaveNotes = useCallback(
    (text: string) => {
      setNotesState("saving");
      setNotesError(null);
      start(() => {
        void (async () => {
          const res = await updateGeneralNotes(collab.id, text);
          if (res.ok) {
            setNotesState("saved");
            router.refresh();
            window.setTimeout(() => setNotesState("idle"), 2000);
          } else {
            setNotesState("err");
            setNotesError(res.error);
          }
        })();
      });
    },
    [collab.id, router]
  );

  useEffect(() => {
    setStatusLocal(collab.status);
  }, [collab.status]);

  useEffect(() => {
    setVisibleEventsCount(10);
  }, [collab.id]);

  useEffect(() => {
    if (notesDebounce.current) clearTimeout(notesDebounce.current);
    notesDebounce.current = setTimeout(() => {
      if ((collab.general_notes ?? "") === notes) return;
      flushSaveNotes(notes);
    }, 1600);
    return () => {
      if (notesDebounce.current) clearTimeout(notesDebounce.current);
    };
  }, [notes, collab.general_notes, flushSaveNotes]);

  const uploadToStorage = async (f: File) => {
    setFormError(null);
    const objectPath = makeCollaborationObjectPath(collab.id, f);
    const { data: up, error: upErr } = await supabase.storage
      .from(COLLAB_FILES_BUCKET)
      .upload(objectPath, f, {
        cacheControl: "3600",
        upsert: false,
        contentType: f.type || undefined,
      });
    if (upErr) {
      throw new Error(upErr.message);
    }
    const { data: pub } = supabase.storage
      .from(COLLAB_FILES_BUCKET)
      .getPublicUrl(up.path);
    return pub.publicUrl;
  };

  const submitEvent = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    start(() => {
      void (async () => {
        setUploading(true);
        try {
          let fileUrl: string | null = null;
          if (file) {
            fileUrl = await uploadToStorage(file);
          }
          const res = await addCollaborationEvent(
            collab.id,
            eventType,
            eventDesc,
            fileUrl,
            new Date(eventAt).toISOString()
          );
          if (!res.ok) {
            setFormError(res.error);
            return;
          }
          setEventDesc("");
          setFile(null);
          setEventAt(toLocalInputDateTimeValue(new Date()));
          setFormError(null);
          const input = document.getElementById(
            `${formId}-file`
          ) as HTMLInputElement | null;
          if (input) input.value = "";
          router.refresh();
        } catch (err) {
          setFormError(err instanceof Error ? err.message : "Caricamento fallito");
        } finally {
          setUploading(false);
        }
      })();
    });
  };

  const submitDeliverable = (e: React.FormEvent) => {
    e.preventDefault();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(delivDate)) {
      setDelivError("Seleziona una data valida");
      return;
    }
    setDelivError(null);
    start(() => {
      void (async () => {
        const res = await addDeliverable(
          collab.id,
          delivType,
          delivDate,
          delivStatus,
          delivContentUrl || undefined
        );
        if (!res.ok) {
          setDelivError(res.error);
          return;
        }
        setDelivDate("");
        setDelivStatus("da girare");
        setDelivContentUrl("");
        router.refresh();
      })();
    });
  };

  useEffect(() => {
    const ch = supabase
      .channel(`collab-events:${collab.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "collaboration_events",
          filter: `collaboration_id=eq.${collab.id}`,
        },
        () => {
          router.refresh();
        }
      )
      .subscribe();
    return () => {
      void ch.unsubscribe();
    };
  }, [collab.id, router]);

  const title = useMemo(
    () =>
      collab.brief_text?.trim() ||
      `Collaborazione ${collab.id.slice(0, 8)}…`,
    [collab.brief_text, collab.id]
  );

  const eur = (n: number) =>
    new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" }).format(n);

  return (
    <div className="min-h-0 text-gray-900">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <Button
          variant="ghost"
          size="sm"
          asChild
          className="gap-1.5 -ml-2.5 text-gray-500 hover:text-gray-800"
        >
          <Link href="/collaborazioni">
            <ArrowLeft className="size-4" />
            Collaborazioni
          </Link>
        </Button>
      </div>
      <DashboardHeader
        title={title}
        description={collab.brand?.name ? `con ${collab.brand.name}` : undefined}
        end={
          <div className="w-full rounded-2xl bg-white/85 p-2.5 shadow-[0_2px_12px_rgba(0,0,0,0.04)] sm:w-auto sm:min-w-[19rem]">
            <div className="flex flex-wrap items-end gap-2">
              <div className="min-w-[12rem] flex-1 space-y-1">
                <span className="block text-xs font-medium text-gray-500">Stato</span>
                <Select
                  value={statusLocal}
                  onValueChange={(v) => {
                    setStatusLocal(v);
                    start(() => {
                      void (async () => {
                        const r = await setCollaborationStatus(collab.id, v);
                        if (r.ok) {
                          router.refresh();
                        } else {
                          setStatusLocal(collab.status);
                          if (process.env.NODE_ENV === "development")
                            console.error(r.error);
                        }
                      })();
                    });
                  }}
                  disabled={pending}
                >
                  <SelectTrigger
                    className="h-9 w-full rounded-xl border-0 bg-gray-50 text-gray-900 shadow-none"
                    id={`${formId}-collab-status`}
                    aria-label="Cambia stato collaborazione"
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {COLLAB_STATUS_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {brandOptions.length > 0 && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setEditCollabOpen(true)}
                  className="h-9 gap-1.5 rounded-xl border-gray-200 bg-white px-3"
                >
                  <PenLine className="size-3.5" />
                  Modifica
                </Button>
              )}
            </div>

            <div className="mt-2.5 border-t border-gray-100 pt-2">
              {collab.paid_at ? (
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700">
                    <CheckCircle2 className="size-3.5" />
                    Saldato il{" "}
                    {new Date(collab.paid_at).toLocaleDateString("it-IT", {
                      day: "2-digit",
                      month: "short",
                      year: "numeric",
                    })}
                  </span>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-7 rounded-full border-gray-200 px-2.5 text-xs"
                    disabled={pending}
                    onClick={() => {
                      start(() => {
                        void (async () => {
                          const r = await setCollaborationPaid(collab.id, false);
                          if (r.ok) {
                            router.refresh();
                          } else if (process.env.NODE_ENV === "development") {
                            console.error(r.error);
                          }
                        })();
                      });
                    }}
                  >
                    Riapri saldo
                  </Button>
                </div>
              ) : (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 rounded-full border-gray-200 px-2.5 text-xs"
                  disabled={pending || !collab.agreed_fee_value}
                  onClick={() => {
                    start(() => {
                      void (async () => {
                        const r = await setCollaborationPaid(collab.id, true);
                        if (r.ok) {
                          router.refresh();
                        } else if (process.env.NODE_ENV === "development") {
                          console.error(r.error);
                        }
                      })();
                    });
                  }}
                >
                  Segna saldata
                </Button>
              )}
            </div>
          </div>
        }
      />
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Badge
          className="border-0 bg-white px-2.5 py-0.5 text-xs text-gray-600 shadow-[0_1px_6px_rgba(0,0,0,0.06)]"
        >
          {statusLocal}
        </Badge>
        {notesState === "saving" && (
          <span className="text-xs text-gray-500">Salvo note…</span>
        )}
        {notesState === "saved" && (
          <span className="text-xs text-blue-600/90">Note sincronizzate</span>
        )}
        {notesState === "err" && <span className="text-xs text-red-600">{notesError}</span>}
      </div>

      <div className="grid min-h-0 items-start gap-6 lg:grid-cols-2 lg:gap-8">
        <div className="min-w-0 space-y-6">
          <div className="flex items-center gap-2 text-sm font-medium text-gray-500">
            <Activity className="size-4 text-blue-500" />
            Linea del tempo
          </div>
          <div className="relative pl-1">
            <ul>
              {data.events.length === 0 && (
                <p className="px-1 text-sm text-gray-500">
                  Ancora nessun evento. Registra un’attività qui sotto.
                </p>
              )}
                {data.events.slice(0, visibleEventsCount).map((ev, idx) => {
                const Icon = EVENT_TYPE_ICONS[ev.event_type] ?? EVENT_TYPE_ICONS.nota;
                const last =
                  idx === Math.min(data.events.length, visibleEventsCount) - 1;
                return (
                  <li key={ev.id} className="relative flex gap-3 pb-6 last:pb-0 sm:gap-4">
                    <div className="flex flex-col items-center self-stretch">
                      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white/80 shadow-[0_1px_8px_rgba(0,0,0,0.06)] ring-1 ring-white/60 backdrop-blur-sm">
                        <Icon className="size-3.5 text-blue-500" />
                      </div>
                      {!last && (
                        <div
                          className="min-h-6 w-px flex-1 bg-gradient-to-b from-gray-200/90 to-gray-200/20"
                          aria-hidden
                        />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div
                        className="rounded-2xl border border-white/40 bg-white/55 p-3.5 shadow-[0_4px_24px_rgba(0,0,0,0.04)] ring-1 ring-white/20 backdrop-blur-md supports-[backdrop-filter]:bg-white/50"
                      >
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div>
                            <div className="flex flex-wrap items-baseline gap-2 text-xs text-gray-500">
                              <span>
                                {formatEventDate(ev.event_at || ev.created_at)}
                              </span>
                              <span className="font-medium uppercase tracking-tight text-gray-400">
                                {EVENT_TYPE_OPTIONS.find(
                                  (o) => o.value === ev.event_type
                                )?.label ?? ev.event_type}
                              </span>
                            </div>
                            <p className="mt-1.5 whitespace-pre-wrap break-words text-sm leading-relaxed text-gray-800">
                              {renderTextWithLinks(ev.description)}
                            </p>
                            {ev.attached_file_url && (
                              <a
                                href={ev.attached_file_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="mt-2 inline-flex items-center gap-1.5 text-sm font-medium text-blue-600 hover:underline"
                              >
                                <Download className="size-3.5" />
                                Apri / scarica allegato
                              </a>
                            )}
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 shrink-0 text-gray-400 hover:bg-white/50 hover:text-blue-600"
                            onClick={() => setEditingEvent(ev)}
                            title="Modifica evento"
                            aria-label="Modifica evento"
                          >
                            <Pencil className="size-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
            {data.events.length > visibleEventsCount && (
              <div className="mt-3 px-1">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="rounded-full border-gray-200 px-3"
                  onClick={() =>
                    setVisibleEventsCount((n) => Math.min(n + 10, data.events.length))
                  }
                >
                  Carica altri ({data.events.length - visibleEventsCount})
                </Button>
              </div>
            )}
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base font-semibold tracking-tight text-gray-900">
                Nuovo evento
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={submitEvent} className="space-y-3">
                <div className="space-y-2">
                  <Label
                    className="text-gray-500"
                    htmlFor={`${formId}-type`}
                  >
                    Tipo
                  </Label>
                  <Select
                    value={eventType}
                    onValueChange={(v) => setEventType(v as EventType)}
                  >
                    <SelectTrigger
                      id={`${formId}-type`}
                      className="w-full rounded-xl border-0 bg-white shadow-[0_1px_8px_rgba(0,0,0,0.04)]"
                    >
                      <SelectValue placeholder="Tipo" />
                    </SelectTrigger>
                    <SelectContent>
                      {EVENT_TYPE_OPTIONS.map((o) => (
                        <SelectItem key={o.value} value={o.value}>
                          {o.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label
                    className="text-gray-500"
                    htmlFor={`${formId}-ev-when`}
                  >
                    Quando
                  </Label>
                  <Input
                    id={`${formId}-ev-when`}
                    type="datetime-local"
                    value={eventAt}
                    onChange={(e) => setEventAt(e.target.value)}
                    max="2099-12-31T23:59"
                    className="rounded-xl border-0 bg-gray-100/50 text-gray-900 focus-visible:ring-2 focus-visible:ring-blue-500/20"
                    disabled={uploading || pending}
                  />
                  <p className="text-xs text-gray-500">
                    Puoi retrodatare per fatti già accaduti.
                  </p>
                </div>
                <div className="space-y-2">
                  <Label className="text-gray-500" htmlFor={`${formId}-desc`}>
                    Cosa è successo?
                  </Label>
                  <Textarea
                    id={`${formId}-desc`}
                    placeholder="Es. Ricevuta mail di brief, Inviato preventivo di 1000€"
                    value={eventDesc}
                    onChange={(e) => setEventDesc(e.target.value)}
                    className="min-h-[100px] rounded-xl border-0 bg-gray-100/50 text-gray-800 placeholder:text-gray-400 focus-visible:ring-2 focus-visible:ring-blue-500/20"
                  />
                </div>
                <div className="space-y-2">
                  <Label
                    className="text-gray-500"
                    htmlFor={`${formId}-file`}
                  >
                    Allegato (PDF, immagini) — opzionale
                  </Label>
                  <Input
                    id={`${formId}-file`}
                    type="file"
                    accept="application/pdf,image/png,image/jpeg,image/webp"
                    onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                    className="cursor-pointer rounded-xl border-0 bg-gray-100/50 file:mr-3 focus-visible:ring-2 focus-visible:ring-blue-500/20"
                    disabled={uploading || pending}
                  />
                </div>
                {formError && (
                  <p className="text-sm text-red-600" role="alert">
                    {formError}
                  </p>
                )}
                <Button type="submit" disabled={pending || uploading}>
                  {uploading || (pending && !formError) ? (
                    <>
                      <Loader2 className="size-4 animate-spin" />
                      {uploading ? "Caricamento in corso…" : "Salvataggio…"}
                    </>
                  ) : (
                    "Registra evento"
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>

        <div className="min-w-0 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base font-semibold tracking-tight text-gray-900">
                <Building2 className="size-4 text-blue-500" />
                Brand & deal
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-gray-800">
              {collab.brand ? (
                <dl className="grid gap-2 sm:grid-cols-2">
                  <div>
                    <dt className="text-xs text-gray-500">Azienda</dt>
                    <dd className="font-medium text-gray-900">
                      {collab.brand.name}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-gray-500">Settore</dt>
                    <dd>{collab.brand.sector ?? "—"}</dd>
                  </div>
                  <div className="sm:col-span-2">
                    <dt className="text-xs text-gray-500">Contatti</dt>
                    <dd className="text-gray-600">
                      {collab.brand.contact_people.length > 0 ? (
                        <ul className="mt-1 space-y-2">
                          {collab.brand.contact_people.map((p, i) => {
                            const name = [p.firstName, p.lastName]
                              .filter(Boolean)
                              .join(" ");
                            return (
                              <li
                                key={i}
                                className="rounded-xl bg-gray-100/50 px-3 py-2 text-sm"
                              >
                                {name ? (
                                  <span className="font-medium text-gray-900">
                                    {name}
                                  </span>
                                ) : null}
                                {p.email ? (
                                  <a
                                    href={`mailto:${p.email}`}
                                    className="mt-0.5 block text-xs text-blue-600 hover:underline"
                                  >
                                    {p.email}
                                  </a>
                                ) : null}
                                {p.whatsapp ? (
                                  <p className="mt-0.5 text-xs text-gray-500">
                                    WhatsApp: {p.whatsapp}
                                  </p>
                                ) : null}
                                {!name && !p.email && !p.whatsapp ? (
                                  <span className="text-gray-400">—</span>
                                ) : null}
                              </li>
                            );
                          })}
                        </ul>
                      ) : (
                        <span className="break-all text-gray-600">
                          {collab.brand.contacts ?? "—"}
                        </span>
                      )}
                    </dd>
                  </div>
                </dl>
              ) : (
                <p className="text-gray-500">Nessun brand collegato.</p>
              )}
              <Separator className="my-1 bg-gray-200/60" />
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-gray-500">
                  <Euro className="size-4" />
                  <span className="text-xs font-medium tracking-wide">
                    {collab.is_periodic ? "Totale pacchetto" : "Fee"}
                  </span>
                </div>
                <span className="text-lg font-semibold tabular-nums text-gray-900">
                  {collab.agreed_fee ?? "—"}
                </span>
              </div>
              {collab.is_periodic && collab.fee_per_content && (
                <p className="text-xs text-gray-500">
                  Compenso per singolo contenuto: {collab.fee_per_content}
                </p>
              )}
              {collab.contract_url && (
                <a
                  href={collab.contract_url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-block text-sm font-medium text-blue-600 hover:underline"
                >
                  Apri URL contratto archiviato
                </a>
              )}
              {collab.agreed_fee_value != null && (
                <div className="rounded-xl bg-gray-50 p-3">
                  <p className="text-xs text-gray-500">Pagamenti registrati</p>
                  <p className="mt-0.5 text-sm font-medium text-gray-900">
                    {eur(collab.paid_total)} / {eur(collab.agreed_fee_value)}
                  </p>
                  <p className="mt-0.5 text-xs text-gray-500">
                    Residuo: {eur(collab.remaining_due ?? 0)}
                  </p>
                </div>
              )}
              <div className="space-y-2 rounded-xl border border-gray-100 p-3">
                <p className="text-xs font-medium text-gray-500">
                  Registra pagamento (anche parziale)
                </p>
                <div className="grid gap-2 sm:grid-cols-2">
                  <Input
                    value={paymentAmount}
                    onChange={(e) => setPaymentAmount(e.target.value)}
                    placeholder="Importo es. 250"
                    className="h-8"
                    disabled={pending}
                  />
                  <Input
                    type="date"
                    value={paymentDate}
                    onChange={(e) => setPaymentDate(e.target.value)}
                    className="h-8"
                    disabled={pending}
                  />
                </div>
                <Input
                  value={paymentNote}
                  onChange={(e) => setPaymentNote(e.target.value)}
                  placeholder="Nota (opzionale)"
                  className="h-8"
                  disabled={pending}
                />
                {paymentError ? <p className="text-xs text-red-600">{paymentError}</p> : null}
                <Button
                  type="button"
                  size="sm"
                  className="h-8 rounded-full"
                  disabled={pending || !paymentAmount.trim()}
                  onClick={() => {
                    setPaymentError(null);
                    start(() => {
                      void (async () => {
                        const r = await addCollaborationPayment({
                          collaborationId: collab.id,
                          amount: paymentAmount,
                          paidAt: paymentDate,
                          note: paymentNote,
                        });
                        if (!r.ok) {
                          setPaymentError(r.error);
                          return;
                        }
                        setPaymentAmount("");
                        setPaymentNote("");
                        router.refresh();
                      })();
                    });
                  }}
                >
                  Registra pagamento
                </Button>
              </div>
              {collab.payments.length > 0 && (
                <ul className="space-y-1">
                  {collab.payments.map((p) => (
                    <li key={p.id} className="rounded-lg bg-gray-50 px-2 py-1.5 text-xs text-gray-600">
                      {editingPaymentId === p.id ? (
                        <div className="space-y-1.5">
                          <div className="grid gap-1 sm:grid-cols-2">
                            <Input
                              value={editingPaymentAmount}
                              onChange={(e) => setEditingPaymentAmount(e.target.value)}
                              className="h-7 text-xs"
                            />
                            <Input
                              type="date"
                              value={editingPaymentDate}
                              onChange={(e) => setEditingPaymentDate(e.target.value)}
                              className="h-7 text-xs"
                            />
                          </div>
                          <Input
                            value={editingPaymentNote}
                            onChange={(e) => setEditingPaymentNote(e.target.value)}
                            className="h-7 text-xs"
                          />
                          <div className="flex gap-1">
                            <Button
                              type="button"
                              size="sm"
                              className="h-7 rounded-full px-2 text-xs"
                              onClick={() => {
                                start(() => {
                                  void (async () => {
                                    const r = await updateCollaborationPayment({
                                      id: p.id,
                                      collaborationId: collab.id,
                                      amount: editingPaymentAmount,
                                      paidAt: editingPaymentDate,
                                      note: editingPaymentNote,
                                    });
                                    if (!r.ok) {
                                      setPaymentError(r.error);
                                      return;
                                    }
                                    setEditingPaymentId(null);
                                    router.refresh();
                                  })();
                                });
                              }}
                            >
                              Salva
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              className="h-7 rounded-full px-2 text-xs"
                              onClick={() => setEditingPaymentId(null)}
                            >
                              Annulla
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center justify-between gap-2">
                          <span>
                            {new Date(p.paid_at + "T12:00:00").toLocaleDateString("it-IT")}{" "}
                            {p.note ? `· ${p.note}` : ""}
                          </span>
                          <div className="flex items-center gap-1">
                            <span className="font-medium text-gray-900">{eur(Number(p.amount))}</span>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6"
                              onClick={() => {
                                setEditingPaymentId(p.id);
                                setEditingPaymentAmount(String(p.amount));
                                setEditingPaymentDate(p.paid_at);
                                setEditingPaymentNote(p.note ?? "");
                              }}
                            >
                              <Pencil className="size-3.5" />
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6 text-gray-400 hover:text-red-600"
                              onClick={() => {
                                start(() => {
                                  void (async () => {
                                    const r = await deleteCollaborationPayment({
                                      id: p.id,
                                      collaborationId: collab.id,
                                    });
                                    if (!r.ok) {
                                      setPaymentError(r.error);
                                      return;
                                    }
                                    router.refresh();
                                  })();
                                });
                              }}
                            >
                              <Trash2 className="size-3.5" />
                            </Button>
                          </div>
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base font-semibold tracking-tight text-gray-900">
                Appunti veloci
              </CardTitle>
              <p className="text-sm text-gray-500">
                Salvataggio automatico; separato dalla linea del tempo.
              </p>
            </CardHeader>
            <CardContent>
              <Textarea
                value={notes}
                onChange={(e) => {
                  setNotesState("idle");
                  setNotes(e.target.value);
                }}
                placeholder="Es. Chiedi formato video, referente Anna, link drive brief…"
                className="min-h-[200px] rounded-2xl border-0 bg-gray-100/50 text-sm text-gray-800 focus-visible:ring-2 focus-visible:ring-blue-500/20"
              />
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => flushSaveNotes(notes)}
                  disabled={notesState === "saving" || (collab.general_notes ?? "") === notes}
                  className="rounded-full border-0 bg-white shadow-[0_1px_8px_rgba(0,0,0,0.05)]"
                >
                  {notesState === "saving" ? (
                    <>
                      <Loader2 className="size-3.5 animate-spin" />
                      Salvataggio…
                    </>
                  ) : (
                    "Salva ora"
                  )}
                </Button>
                <span className="text-xs text-gray-500">
                  Autosalvataggio ~1,6s dopo le modifiche
                </span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex flex-col gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <CardTitle className="flex items-center gap-2 text-base font-semibold tracking-tight text-gray-900">
                    <CalendarPlus className="size-4 shrink-0 text-blue-500" />
                    Scadenzario contenuti
                  </CardTitle>
                  {collab.is_periodic && (
                    <Badge
                      variant="secondary"
                      className="border-0 bg-blue-50/95 font-medium text-blue-800 shadow-[0_1px_4px_rgba(0,0,0,0.04)]"
                    >
                      🔄 Collaborazione periodica (
                      {collab.content_count ?? data.deliverables.length} contenuti)
                    </Badge>
                  )}
                </div>
                <p className="text-sm text-gray-500">
                  I deliverables con data alimentano il calendario globale.
                </p>
              </div>
            </CardHeader>
            <CardContent>
              {data.deliverables.length > 0 ? (
                <ul className="mb-4 max-h-64 list-none space-y-1.5 overflow-y-auto pr-0.5 pl-0 text-sm sm:max-h-72">
                  {data.deliverables.map((d) => (
                    <DeliverableRowEditor
                      key={d.id}
                      collaborationId={collab.id}
                      row={d}
                    />
                  ))}
                </ul>
              ) : (
                <p className="mb-4 text-sm text-gray-500">Nessun deliverable.</p>
              )}

              <form
                onSubmit={submitDeliverable}
                className="space-y-3 border-t border-gray-200/60 pt-4"
              >
                <div className="space-y-2">
                  <Label className="text-gray-500">Contenuto</Label>
                  <Select
                    value={delivType}
                    onValueChange={(v) =>
                      setDelivType(v as (typeof deliverableTypes)[number])
                    }
                  >
                    <SelectTrigger className="w-full rounded-xl border-0 bg-white shadow-[0_1px_8px_rgba(0,0,0,0.04)]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {deliverableTypes.map((t) => (
                        <SelectItem key={t} value={t}>
                          {t}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-gray-500" htmlFor={`${formId}-dd`}>
                    Data di pubblicazione
                  </Label>
                  <Input
                    id={`${formId}-dd`}
                    type="date"
                    value={delivDate}
                    onChange={(e) => setDelivDate(e.target.value)}
                    required
                    className="rounded-xl border-0 bg-gray-100/50 focus-visible:ring-2 focus-visible:ring-blue-500/20"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-gray-500">Stato</Label>
                  <Select
                    value={delivStatus}
                    onValueChange={(v) =>
                      setDelivStatus(v as DeliverableWorkflowStatus)
                    }
                  >
                    <SelectTrigger className="w-full rounded-xl border-0 bg-white shadow-[0_1px_8px_rgba(0,0,0,0.04)]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {DELIVERABLE_STATUS_OPTIONS.map((o) => (
                        <SelectItem key={o.value} value={o.value}>
                          {o.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-gray-500" htmlFor={`${formId}-durl`}>
                    Link al contenuto (opz.)
                  </Label>
                  <Input
                    id={`${formId}-durl`}
                    type="url"
                    value={delivContentUrl}
                    onChange={(e) => setDelivContentUrl(e.target.value)}
                    placeholder="https://youtube.com/… o instagram.com/…"
                    className="rounded-xl border-0 bg-gray-100/50 text-gray-900 placeholder:text-gray-400 focus-visible:ring-2 focus-visible:ring-blue-500/20"
                    disabled={pending}
                  />
                </div>
                {delivError && (
                  <p className="text-sm text-red-600" role="alert">
                    {delivError}
                  </p>
                )}
                <Button type="submit" size="sm" className="w-full sm:w-auto" disabled={pending}>
                  {pending ? <Loader2 className="size-4 animate-spin" /> : "Aggiungi scadenza"}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>

      <EditTimelineEventDialog
        collaborationId={collab.id}
        event={editingEvent}
        open={editingEvent !== null}
        onOpenChange={(o) => {
          if (!o) setEditingEvent(null);
        }}
        onUpdated={() => router.refresh()}
      />
      <EditCollaborationDialog
        data={data}
        brands={brandOptions}
        open={editCollabOpen}
        onOpenChange={setEditCollabOpen}
      />
    </div>
  );
}
