"use client";

import { updateDeliverable } from "@/lib/actions/collaboration";
import {
  DELIVERABLE_STATUS_OPTIONS,
  type DeliverableWorkflowStatus,
  isDeliverableWorkflowStatus,
} from "@/lib/deliverable-statuses";
import type { DeliverableRow } from "@/lib/data/collaboration-detail";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ExternalLink, Loader2, Pencil } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useId, useState, useTransition } from "react";

const deliverableTypes = ["Video YouTube", "Reel IG", "Story"] as const;

function statusLabelDb(db: string) {
  const o = DELIVERABLE_STATUS_OPTIONS.find((x) => x.value === db);
  return o?.label ?? db;
}

function formatDateShort(iso: string | null) {
  if (!iso) return "—";
  try {
    return new Date(iso + "T12:00:00").toLocaleDateString("it-IT", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch {
    return iso;
  }
}

type Props = {
  collaborationId: string;
  row: DeliverableRow;
};

export function DeliverableRowEditor({ collaborationId, row }: Props) {
  const router = useRouter();
  const formId = useId();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const [type, setType] = useState(row.type);
  const [publishDate, setPublishDate] = useState(row.publish_date ?? "");
  const [status, setStatus] = useState<DeliverableWorkflowStatus>(() =>
    isDeliverableWorkflowStatus(row.status) ? row.status : "da girare"
  );
  const [contentUrl, setContentUrl] = useState(row.content_url ?? "");

  useEffect(() => {
    setType(row.type);
    setPublishDate(row.publish_date ?? "");
    setStatus(
      isDeliverableWorkflowStatus(row.status) ? row.status : "da girare"
    );
    setContentUrl(row.content_url ?? "");
  }, [row.id, row.type, row.publish_date, row.status, row.content_url]);

  useEffect(() => {
    if (open) {
      setErr(null);
      setType(row.type);
      setPublishDate(row.publish_date ?? "");
      setStatus(
        isDeliverableWorkflowStatus(row.status) ? row.status : "da girare"
      );
      setContentUrl(row.content_url ?? "");
    }
  }, [open, row]);

  const save = () => {
    if (!publishDate.trim()) {
      setErr("Imposta una data di pubblicazione.");
      return;
    }
    setErr(null);
    start(() => {
      void (async () => {
        const res = await updateDeliverable(collaborationId, row.id, {
          type,
          publishDate,
          status,
          contentUrl: contentUrl.trim() || null,
        });
        if (!res.ok) {
          setErr(res.error);
          return;
        }
        setOpen(false);
        router.refresh();
      })();
    });
  };

  const displayStatus = isDeliverableWorkflowStatus(row.status)
    ? statusLabelDb(row.status)
    : row.status;

  return (
    <li className="list-none">
      <div className="group flex min-h-8 items-center gap-2 rounded-xl border border-white/30 bg-white/50 px-2.5 py-1 pr-0.5 text-sm shadow-[0_1px_3px_rgba(0,0,0,0.03)] backdrop-blur-sm">
        <div className="min-w-0 flex-1 leading-tight">
          <div className="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-0.5 sm:flex-nowrap">
            <span className="shrink-0 font-medium text-gray-900" title={row.type}>
              {row.type}
            </span>
            <span
              className="hidden text-gray-300 sm:inline"
              aria-hidden
            >
              ·
            </span>
            <time
              className="shrink-0 text-[13px] text-gray-600 tabular-nums"
              dateTime={row.publish_date ?? undefined}
            >
              {formatDateShort(row.publish_date)}
            </time>
            <span className="hidden text-gray-300 sm:inline" aria-hidden>
              ·
            </span>
            <span
              className="min-w-0 truncate text-[13px] text-gray-500"
              title={displayStatus}
            >
              {displayStatus}
            </span>
          </div>
        </div>
        {row.content_url ? (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-7 w-7 shrink-0 text-gray-400 hover:bg-gray-200/50 hover:text-blue-600"
            asChild
            title="Apri link al contenuto"
          >
            <a href={row.content_url} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="size-3.5" />
            </a>
          </Button>
        ) : null}
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-7 w-7 shrink-0 text-gray-400 opacity-80 transition-opacity hover:bg-gray-200/50 hover:text-blue-600 group-hover:opacity-100"
          onClick={() => setOpen(true)}
          aria-label="Modifica scadenza"
        >
          <Pencil className="size-3.5" />
        </Button>
      </div>

      <Dialog
        open={open}
        onOpenChange={(o) => {
          setOpen(o);
          if (!o) setErr(null);
        }}
      >
        <DialogContent className="max-w-md gap-0 border border-gray-200/80 bg-white p-0 text-gray-900 shadow-xl sm:max-w-md">
          <DialogHeader className="space-y-1 border-b border-gray-100/80 px-5 py-4 text-left">
            <DialogTitle className="text-base font-semibold text-gray-900">
              Modifica scadenza
            </DialogTitle>
            <DialogDescription className="text-sm text-gray-500">
              Tipo, data, stato e link al video o al reel pubblicato.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 px-5 py-4">
            <div className="space-y-2">
              <Label
                htmlFor={`${formId}-t`}
                className="text-xs font-medium text-gray-600"
              >
                Tipo
              </Label>
              <Select
                value={type}
                onValueChange={(v) =>
                  setType(v as (typeof deliverableTypes)[number])
                }
                disabled={pending}
              >
                <SelectTrigger
                  id={`${formId}-t`}
                  className="h-9 rounded-xl border border-gray-200 bg-white text-gray-900"
                >
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
              <Label
                htmlFor={`${formId}-d`}
                className="whitespace-nowrap text-xs font-medium text-gray-600"
              >
                Data di pubblicazione
              </Label>
              <Input
                id={`${formId}-d`}
                type="date"
                value={publishDate}
                onChange={(e) => setPublishDate(e.target.value)}
                disabled={pending}
                className="h-9 rounded-xl border border-gray-200 bg-white text-gray-900"
              />
            </div>
            <div className="space-y-2">
              <Label
                htmlFor={`${formId}-s`}
                className="text-xs font-medium text-gray-600"
              >
                Stato
              </Label>
              <Select
                value={status}
                onValueChange={(v) => setStatus(v as DeliverableWorkflowStatus)}
                disabled={pending}
              >
                <SelectTrigger
                  id={`${formId}-s`}
                  className="h-9 rounded-xl border border-gray-200 bg-white text-gray-900"
                >
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
              <Label
                htmlFor={`${formId}-u`}
                className="text-xs font-medium text-gray-600"
              >
                Link al contenuto (opz.)
              </Label>
              <Input
                id={`${formId}-u`}
                type="url"
                value={contentUrl}
                onChange={(e) => setContentUrl(e.target.value)}
                disabled={pending}
                placeholder="https://…"
                className="h-9 rounded-xl border border-gray-200 bg-white text-sm text-gray-900 placeholder:text-gray-400"
              />
            </div>
            {!isDeliverableWorkflowStatus(row.status) && (
              <p className="text-xs text-amber-700">
                Stato in archivio non riconosciuto; scegline uno e salva.
              </p>
            )}
            {err && (
              <p className="text-sm text-red-600" role="alert">
                {err}
              </p>
            )}
          </div>
          <DialogFooter className="gap-2 border-t border-gray-100/80 px-5 py-3 sm:justify-end">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="rounded-full text-gray-600"
              onClick={() => setOpen(false)}
              disabled={pending}
            >
              Annulla
            </Button>
            <Button
              type="button"
              size="sm"
              className="min-w-[5.5rem] rounded-full"
              onClick={save}
              disabled={pending}
            >
              {pending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                "Salva"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </li>
  );
}
