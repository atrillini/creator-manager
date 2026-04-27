"use client";

import {
  deleteCollaborationEvent,
  updateCollaborationEvent,
} from "@/lib/actions/collaboration";
import { EVENT_TYPE_OPTIONS } from "@/lib/collab-event-types";
import { COLLAB_FILES_BUCKET, makeCollaborationObjectPath } from "@/lib/storage-constants";
import type { CollaborationEventRow } from "@/lib/data/collaboration-detail";
import { supabase } from "@/lib/supabase";
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
import { Textarea } from "@/components/ui/textarea";
import { Download, Loader2, Trash2 } from "lucide-react";
import { useCallback, useEffect, useId, useState, useTransition } from "react";
import type { EventType } from "@/lib/collab-event-types";

function toLocalInputDateTimeValue(d: Date) {
  const t = d.getTime() - d.getTimezoneOffset() * 60_000;
  return new Date(t).toISOString().slice(0, 16);
}

type Props = {
  event: CollaborationEventRow | null;
  collaborationId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdated: () => void;
};

export function EditTimelineEventDialog({
  event,
  collaborationId,
  open,
  onOpenChange,
  onUpdated,
}: Props) {
  const formId = useId();
  const [pending, start] = useTransition();
  const [deleting, setDeleting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [eventType, setEventType] = useState<EventType>("nota");
  const [eventAt, setEventAt] = useState(() => toLocalInputDateTimeValue(new Date()));
  const [eventDesc, setEventDesc] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [removeAttachment, setRemoveAttachment] = useState(false);
  const [currentUrl, setCurrentUrl] = useState<string | null>(null);

  const loadFromEvent = useCallback((ev: CollaborationEventRow) => {
    setEventType(ev.event_type);
    setEventAt(
      toLocalInputDateTimeValue(new Date(ev.event_at || ev.created_at))
    );
    setEventDesc(ev.description?.trim() ?? "");
    setFile(null);
    setRemoveAttachment(false);
    setFormError(null);
    setCurrentUrl(ev.attached_file_url);
  }, []);

  useEffect(() => {
    if (open && event) {
      loadFromEvent(event);
    }
  }, [open, event, loadFromEvent]);

  const uploadToStorage = async (f: File) => {
    setFormError(null);
    const objectPath = makeCollaborationObjectPath(collaborationId, f);
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

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!event) return;
    setFormError(null);
    start(() => {
      void (async () => {
        setUploading(true);
        try {
          let fileUrl: string | null;
          if (file) {
            fileUrl = await uploadToStorage(file);
          } else if (removeAttachment) {
            fileUrl = null;
          } else {
            fileUrl = currentUrl;
          }
          const res = await updateCollaborationEvent(
            collaborationId,
            event.id,
            {
              eventType,
              description: eventDesc,
              eventAtIso: new Date(eventAt).toISOString(),
              attachedFileUrl: fileUrl,
            }
          );
          if (!res.ok) {
            setFormError(res.error);
            return;
          }
          onUpdated();
          onOpenChange(false);
        } catch (err) {
          setFormError(err instanceof Error ? err.message : "Errore caricamento file");
        } finally {
          setUploading(false);
        }
      })();
    });
  };

  const handleDelete = () => {
    if (!event) return;
    if (
      !window.confirm("Eliminare definitivamente questo evento dalla linea del tempo?")
    ) {
      return;
    }
    setFormError(null);
    setDeleting(true);
    start(() => {
      void (async () => {
        const res = await deleteCollaborationEvent(collaborationId, event.id);
        setDeleting(false);
        if (!res.ok) {
          setFormError(res.error);
          return;
        }
        onUpdated();
        onOpenChange(false);
      })();
    });
  };

  if (!event) {
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[min(90vh,720px)] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-gray-900">Modifica evento</DialogTitle>
          <DialogDescription className="text-gray-500">
            Aggiorna tipo, data e testo. Puoi sostituire o rimuovere l&rsquo;allegato.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-3">
          <div className="space-y-2">
            <Label className="text-gray-500" htmlFor={`${formId}-etype`}>
              Tipo
            </Label>
            <Select
              value={eventType}
              onValueChange={(v) => setEventType(v as EventType)}
              disabled={pending || uploading}
            >
              <SelectTrigger
                id={`${formId}-etype`}
                className="w-full rounded-xl border-0 bg-gray-100/50 shadow-none"
              >
                <SelectValue />
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
            <Label className="text-gray-500" htmlFor={`${formId}-ewhen`}>
              Quando
            </Label>
            <Input
              id={`${formId}-ewhen`}
              type="datetime-local"
              value={eventAt}
              onChange={(e) => setEventAt(e.target.value)}
              className="rounded-xl border-0 bg-gray-100/50"
              disabled={pending || uploading}
            />
          </div>
          <div className="space-y-2">
            <Label className="text-gray-500" htmlFor={`${formId}-edesc`}>
              Descrizione
            </Label>
            <Textarea
              id={`${formId}-edesc`}
              value={eventDesc}
              onChange={(e) => setEventDesc(e.target.value)}
              rows={4}
              className="min-h-[88px] rounded-2xl border-0 bg-gray-100/50"
              disabled={pending || uploading}
            />
          </div>
          {currentUrl && !removeAttachment && !file && (
            <div className="flex flex-wrap items-center gap-2">
              <a
                href={currentUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-sm font-medium text-blue-600 hover:underline"
              >
                <Download className="size-3.5" />
                Apri allegato attuale
              </a>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="text-gray-500"
                onClick={() => {
                  setRemoveAttachment(true);
                  setFile(null);
                }}
                disabled={pending}
              >
                Rimuovi allegato
              </Button>
            </div>
          )}
          {removeAttachment && !file && (
            <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs text-gray-500">Allegato: verrà rimosso al salvataggio.</p>
              <Button
                type="button"
                variant="link"
                size="sm"
                className="h-auto shrink-0 self-start p-0 sm:self-center"
                onClick={() => setRemoveAttachment(false)}
              >
                Annulla rimozione
              </Button>
            </div>
          )}
          <div className="space-y-2">
            <Label className="text-gray-500" htmlFor={`${formId}-efile`}>
              Sostituisci allegato (opz.)
            </Label>
            <Input
              id={`${formId}-efile`}
              type="file"
              accept="application/pdf,image/png,image/jpeg,image/webp"
              onChange={(e) => {
                setFile(e.target.files?.[0] ?? null);
                if (e.target.files?.[0]) setRemoveAttachment(false);
              }}
              disabled={pending || uploading}
              className="cursor-pointer"
            />
          </div>
          {formError && <p className="text-sm text-red-600">{formError}</p>}
          <DialogFooter className="gap-2 sm:justify-between">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="text-red-600 hover:bg-red-50 hover:text-red-700"
              onClick={handleDelete}
              disabled={deleting || pending || uploading}
            >
              {deleting ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}{" "}
              Elimina
            </Button>
            <div className="flex w-full flex-wrap justify-end gap-2 sm:w-auto">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={pending || uploading}
              >
                Annulla
              </Button>
              <Button type="submit" disabled={pending || uploading || deleting}>
                {uploading || (pending && !deleting) ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  "Salva modifiche"
                )}
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
