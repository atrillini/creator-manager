"use client";

import { deleteFinancialMovement, saveFinancialMovement } from "@/lib/actions/financials";
import type { CollaborationOption, FinancialRow } from "@/lib/data/fetchers";
import { MANUAL_FINANCIAL_TYPE_OPTIONS, type ManualFinancialType } from "@/lib/financial-types";
import { numberToItalianInput } from "@/lib/collaboration-form-shared";
import { toYmd } from "@/lib/format";
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
import { Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useId, useState, useTransition } from "react";

const NO_COLLAB = "__none__";

type Props = {
  collaborations: CollaborationOption[];
  /** Assente = nuovo movimento. */
  movement?: { id: string } & NonNullable<FinancialRow["manual"]>;
};

export function FinancialMovementDialog({ collaborations, movement }: Props) {
  const router = useRouter();
  const formId = useId();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const [type, setType] = useState<ManualFinancialType>("Altra spesa");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState("");
  const [description, setDescription] = useState("");
  const [collaborationId, setCollaborationId] = useState(NO_COLLAB);

  function openDialog() {
    setErr(null);
    setType((movement?.type as ManualFinancialType) ?? "Altra spesa");
    setAmount(movement ? numberToItalianInput(movement.amount) : "");
    setDate(movement?.date ?? toYmd(new Date()));
    setDescription(movement?.description ?? "");
    setCollaborationId(movement?.collaborationId ?? NO_COLLAB);
    setOpen(true);
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    start(async () => {
      const res = await saveFinancialMovement({
        id: movement?.id,
        type,
        amount,
        date,
        description,
        collaborationId: collaborationId === NO_COLLAB ? null : collaborationId,
      });
      if (!res.ok) {
        setErr(res.error);
        return;
      }
      setOpen(false);
      router.refresh();
    });
  }

  function onDelete() {
    if (!movement || !window.confirm("Eliminare questo movimento?")) return;
    start(async () => {
      const res = await deleteFinancialMovement(movement.id);
      if (!res.ok) {
        setErr(res.error);
        return;
      }
      setOpen(false);
      router.refresh();
    });
  }

  const hint = MANUAL_FINANCIAL_TYPE_OPTIONS.find((o) => o.value === type)?.hint;

  return (
    <>
      {movement ? (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-gray-400 hover:text-gray-900"
          onClick={openDialog}
          aria-label="Modifica movimento"
        >
          <Pencil className="size-3.5" />
        </Button>
      ) : (
        <Button type="button" size="sm" className="h-8 gap-1 rounded-full px-3 text-xs" onClick={openDialog}>
          <Plus className="size-3.5" />
          Nuovo movimento
        </Button>
      )}
      <Dialog open={open} onOpenChange={(o) => !pending && setOpen(o)}>
        <DialogContent className="max-w-md border border-gray-200/80 bg-white text-gray-900">
          <DialogHeader>
            <DialogTitle>{movement ? "Modifica movimento" : "Nuovo movimento"}</DialogTitle>
            <DialogDescription className="text-sm text-gray-500">
              Entrate extra e spese. Gli incassi delle collaborazioni si registrano dalla scheda
              collaborazione; YouTube arriva dalla sync.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={onSubmit} className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor={`${formId}-type`}>Tipo</Label>
              <Select value={type} onValueChange={(v) => setType(v as ManualFinancialType)}>
                <SelectTrigger id={`${formId}-type`} className="border-gray-200 bg-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MANUAL_FINANCIAL_TYPE_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {hint ? <p className="text-[11px] text-gray-500">{hint}</p> : null}
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor={`${formId}-amount`}>Importo (€)</Label>
                <Input
                  id={`${formId}-amount`}
                  inputMode="decimal"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0,00"
                  required
                  disabled={pending}
                  className="border-gray-200 bg-white"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor={`${formId}-date`}>Data</Label>
                <Input
                  id={`${formId}-date`}
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  required
                  disabled={pending}
                  className="border-gray-200 bg-white"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={`${formId}-desc`}>Descrizione</Label>
              <Input
                id={`${formId}-desc`}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Es. microfono, abbonamento Adobe, affiliazione Amazon"
                maxLength={500}
                disabled={pending}
                className="border-gray-200 bg-white"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={`${formId}-collab`}>Collaborazione (opzionale)</Label>
              <Select value={collaborationId} onValueChange={setCollaborationId}>
                <SelectTrigger id={`${formId}-collab`} className="border-gray-200 bg-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_COLLAB}>Nessuna</SelectItem>
                  {collaborations.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {err ? (
              <p className="text-sm text-red-600" role="alert">
                {err}
              </p>
            ) : null}
            <DialogFooter className="gap-2 sm:justify-between">
              {movement ? (
                <Button
                  type="button"
                  variant="ghost"
                  className="gap-1 text-red-600 hover:bg-red-50 hover:text-red-700"
                  onClick={onDelete}
                  disabled={pending}
                >
                  <Trash2 className="size-4" />
                  Elimina
                </Button>
              ) : (
                <span />
              )}
              <Button type="submit" disabled={pending} className="rounded-full">
                {pending ? <Loader2 className="size-4 animate-spin" /> : null}
                Salva
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
