"use client";

import {
  cancelReceipt,
  deleteReceipt,
  markReceiptPaid,
  reopenReceipt,
} from "@/lib/actions/receipts";
import type { ReceiptFormOptions, ReceiptRow } from "@/lib/data/receipts";
import { RECEIPT_STATUS_LABELS, formatReceiptNumber, type ReceiptStatus } from "@/lib/receipts/model";
import { ReceiptFormDialog } from "@/components/ricevute/receipt-form-dialog";
import { Badge } from "@/components/ui/badge";
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
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import {
  Ban,
  CheckCircle2,
  Download,
  FileText,
  Loader2,
  Pencil,
  RotateCcw,
  Trash2,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

const eur = (n: number) =>
  new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" }).format(n);

const dateIt = (iso: string) => new Date(`${iso}T12:00:00`).toLocaleDateString("it-IT");

const STATUS_CLASS: Record<ReceiptStatus, string> = {
  emessa: "bg-amber-50 text-amber-700",
  pagata: "bg-emerald-50 text-emerald-700",
  annullata: "bg-gray-100 text-gray-500 line-through",
};

type Props = { receipts: ReceiptRow[]; options: ReceiptFormOptions };

export function ReceiptsTable({ receipts, options }: Props) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const [editing, setEditing] = useState<ReceiptRow | null>(null);
  const [paying, setPaying] = useState<ReceiptRow | null>(null);

  function run(action: () => Promise<{ ok: true } | { ok: false; error: string }>) {
    setErr(null);
    start(async () => {
      const res = await action();
      if (!res.ok) {
        setErr(res.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="ui-enter overflow-hidden rounded-3xl bg-white shadow-[0_8px_30px_rgba(0,0,0,0.04)]">
      {err && (
        <p className="border-b border-red-100 bg-red-50 px-4 py-2 text-sm text-red-700" role="alert">
          {err}
        </p>
      )}
      <Table>
        <TableHeader>
          <TableRow className="border-0 border-b border-gray-100/80">
            <TableHead className="text-gray-500">N°</TableHead>
            <TableHead className="text-gray-500">Data</TableHead>
            <TableHead className="text-gray-500">Committente</TableHead>
            <TableHead className="text-gray-500">Collaborazione</TableHead>
            <TableHead className="text-right text-gray-500">Lordo</TableHead>
            <TableHead className="text-right text-gray-500">Netto</TableHead>
            <TableHead className="text-gray-500">Stato</TableHead>
            <TableHead className="w-[1%] text-right text-gray-500">
              <span className="sr-only">Azioni</span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {receipts.length === 0 && (
            <TableRow>
              <TableCell colSpan={8} className="py-10 text-center text-sm text-gray-400">
                Nessuna ricevuta per questo anno.
              </TableCell>
            </TableRow>
          )}
          {receipts.map((r) => (
            <TableRow key={r.id} className="border-0 border-b border-gray-50/90">
              <TableCell className="whitespace-nowrap font-mono text-sm text-gray-900">
                {formatReceiptNumber(r.number, r.year)}
              </TableCell>
              <TableCell className="whitespace-nowrap text-gray-500">{dateIt(r.issueDate)}</TableCell>
              <TableCell className="text-gray-900">
                <span className="font-medium">{r.recipient.name}</span>
                <span className="ml-1.5 text-[11px] uppercase text-gray-400">{r.language}</span>
              </TableCell>
              <TableCell className="max-w-[14rem] truncate text-gray-500">
                {r.collaborationId ? (
                  <Link href={`/collaborations/${r.collaborationId}`} className="hover:text-blue-600 hover:underline">
                    {r.collaborationTitle ?? "Collaborazione"}
                  </Link>
                ) : (
                  "—"
                )}
              </TableCell>
              <TableCell className="whitespace-nowrap text-right font-mono text-sm text-gray-900">
                {eur(r.gross)}
              </TableCell>
              <TableCell className="whitespace-nowrap text-right font-mono text-sm text-gray-500">
                {r.withholding > 0 ? eur(r.net) : "—"}
              </TableCell>
              <TableCell className="whitespace-nowrap">
                <div className="flex items-center gap-1">
                  <Badge variant="muted" className={cn("text-[11px]", STATUS_CLASS[r.status])}>
                    {RECEIPT_STATUS_LABELS[r.status]}
                    {r.status === "pagata" && r.paidAt ? ` · ${dateIt(r.paidAt)}` : ""}
                  </Badge>
                  {r.isLegacy && (
                    <Badge variant="muted" className="bg-gray-100 text-[11px] text-gray-500">
                      Legacy
                    </Badge>
                  )}
                </div>
              </TableCell>
              <TableCell className="w-[1%] whitespace-nowrap p-1 text-right">
                <div className="inline-flex items-center">
                  {!r.isLegacy && (
                    <>
                      <IconLink href={`/api/ricevute/${r.id}/pdf`} label="Apri PDF" newTab>
                        <FileText className="size-4" />
                      </IconLink>
                      <IconLink href={`/api/ricevute/${r.id}/pdf?download=1`} label="Scarica PDF">
                        <Download className="size-4" />
                      </IconLink>
                    </>
                  )}
                  {r.status === "emessa" && (
                    <IconButton label="Segna come pagata" onClick={() => setPaying(r)} disabled={pending}>
                      <CheckCircle2 className="size-4" />
                    </IconButton>
                  )}
                  {r.status !== "emessa" && (
                    <IconButton
                      label={r.status === "pagata" ? "Riporta a emessa" : "Ripristina"}
                      disabled={pending}
                      onClick={() => {
                        const msg =
                          r.status === "pagata" && r.paymentId
                            ? "Riportare la ricevuta a 'emessa'? Verrà rimosso anche il pagamento registrato in automatico sulla collaborazione."
                            : "Riportare la ricevuta a 'emessa'?";
                        if (window.confirm(msg)) run(() => reopenReceipt(r.id));
                      }}
                    >
                      <RotateCcw className="size-4" />
                    </IconButton>
                  )}
                  <IconButton label="Modifica" onClick={() => setEditing(r)} disabled={pending}>
                    <Pencil className="size-4" />
                  </IconButton>
                  {r.status === "emessa" && !r.isLegacy && (
                    <IconButton
                      label="Annulla ricevuta"
                      disabled={pending}
                      onClick={() => {
                        if (
                          window.confirm(
                            `Annullare la ricevuta n° ${formatReceiptNumber(r.number, r.year)}? Il numero resta nel registro.`
                          )
                        )
                          run(() => cancelReceipt(r.id));
                      }}
                    >
                      <Ban className="size-4" />
                    </IconButton>
                  )}
                  <IconButton
                    label="Elimina"
                    className="hover:text-red-600"
                    disabled={pending}
                    onClick={() => {
                      if (
                        window.confirm(
                          `Eliminare definitivamente la ricevuta n° ${formatReceiptNumber(r.number, r.year)}? Per le ricevute già inviate è preferibile "Annulla".`
                        )
                      )
                        run(() => deleteReceipt(r.id));
                    }}
                  >
                    <Trash2 className="size-4" />
                  </IconButton>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {editing && (
        <ReceiptFormDialog
          options={options}
          mode="edit"
          receipt={editing}
          open
          onOpenChange={(o) => !o && setEditing(null)}
        />
      )}
      {paying && <MarkPaidDialog receipt={paying} onClose={() => setPaying(null)} />}
    </div>
  );
}

function IconButton({
  label,
  children,
  className,
  ...props
}: React.ComponentProps<typeof Button> & { label: string }) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      title={label}
      aria-label={label}
      className={cn("h-8 w-8 text-gray-500 hover:text-gray-900", className)}
      {...props}
    >
      {children}
    </Button>
  );
}

function IconLink({
  href,
  label,
  newTab,
  children,
}: {
  href: string;
  label: string;
  newTab?: boolean;
  children: React.ReactNode;
}) {
  return (
    <Button asChild variant="ghost" size="icon" className="h-8 w-8 text-gray-500 hover:text-gray-900">
      <a
        href={href}
        title={label}
        aria-label={label}
        {...(newTab ? { target: "_blank", rel: "noreferrer" } : {})}
      >
        {children}
      </a>
    </Button>
  );
}

function MarkPaidDialog({ receipt, onClose }: { receipt: ReceiptRow; onClose: () => void }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const [paidAt, setPaidAt] = useState(() => new Date().toISOString().slice(0, 10));
  const [registerPayment, setRegisterPayment] = useState(Boolean(receipt.collaborationId));

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md border border-gray-200/80 bg-white text-gray-900">
        <DialogHeader>
          <DialogTitle className="text-lg text-gray-900">
            Ricevuta n° {formatReceiptNumber(receipt.number, receipt.year)} pagata
          </DialogTitle>
          <DialogDescription className="text-sm text-gray-500">
            {receipt.recipient.name} · {eur(receipt.withholding > 0 ? receipt.net : receipt.gross)}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label className="mb-1 block text-[11px] text-gray-500">Data incasso</Label>
            <Input type="date" value={paidAt} onChange={(e) => setPaidAt(e.target.value)} className="h-8" />
          </div>
          {receipt.collaborationId && (
            <label className="flex items-center justify-between gap-3 rounded-2xl border border-gray-100 p-3">
              <span>
                <span className="block text-sm text-gray-800">Registra il pagamento sulla collaborazione</span>
                <span className="block text-[11px] text-gray-500">
                  Aggiunge {eur(receipt.gross)} ai pagamenti di “{receipt.collaborationTitle ?? "collaborazione"}”.
                </span>
              </span>
              <Switch checked={registerPayment} onCheckedChange={setRegisterPayment} />
            </label>
          )}
          {err && <p className="text-sm text-red-600">{err}</p>}
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose} disabled={pending} className="border-gray-200">
            Annulla
          </Button>
          <Button
            type="button"
            className="rounded-full"
            disabled={pending}
            onClick={() => {
              setErr(null);
              start(async () => {
                const res = await markReceiptPaid({ id: receipt.id, paidAt, registerPayment });
                if (!res.ok) {
                  setErr(res.error);
                  return;
                }
                onClose();
                router.refresh();
              });
            }}
          >
            {pending ? <Loader2 className="size-4 animate-spin" /> : null}
            Segna pagata
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
