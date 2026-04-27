"use client";

import { updateBrand } from "@/lib/actions/brand";
import {
  emptyBrandContact,
  parseContactsJson,
  type BrandContact,
} from "@/lib/brand-contacts";
import type { BrandRow } from "@/lib/data/fetchers";
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
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { Loader2, Pencil, Trash2, UserPlus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useId, useState, useTransition } from "react";

type Props = { brand: BrandRow };

export function EditBrandDialog({ brand }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const [name, setName] = useState(brand.name);
  const [sector, setSector] = useState(brand.sector ?? "");
  const [notes, setNotes] = useState(brand.notes ?? "");
  const [people, setPeople] = useState<BrandContact[]>([emptyBrandContact()]);
  const nameId = useId();

  useEffect(() => {
    if (!open) return;
    setName(brand.name);
    setSector(brand.sector ?? "");
    setNotes(brand.notes ?? "");
    const parsed = parseContactsJson(brand.contacts_json);
    setPeople(parsed.length > 0 ? parsed : [emptyBrandContact()]);
    setErr(null);
  }, [open, brand]);

  function setPerson(index: number, patch: Partial<BrandContact>) {
    setPeople((prev) => {
      const next = [...prev];
      const cur = next[index];
      if (!cur) return prev;
      next[index] = { ...cur, ...patch };
      return next;
    });
  }

  function addPerson() {
    setPeople((p) => [...p, emptyBrandContact()]);
  }

  function removePerson(index: number) {
    setPeople((p) => p.filter((_, i) => i !== index));
  }

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErr(null);
    start(() => {
      void (async () => {
        const res = await updateBrand({
          id: brand.id,
          name,
          sector,
          contactPeople: people,
          notes,
        });
        if (!res.ok) {
          setErr(res.error);
          return;
        }
        setOpen(false);
        router.refresh();
      })();
    });
  }

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-8 w-8 shrink-0 text-gray-500 hover:text-gray-900"
        onClick={() => setOpen(true)}
        aria-label={`Modifica ${brand.name}`}
      >
        <Pencil className="size-4" />
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          onPointerDownOutside={(e) => pending && e.preventDefault()}
          onEscapeKeyDown={(e) => pending && e.preventDefault()}
          aria-busy={pending}
          className="max-h-[min(90vh,720px)] max-w-lg overflow-y-auto border border-gray-200/80 bg-white text-gray-900"
        >
          <DialogHeader>
            <DialogTitle className="text-lg text-gray-900">Modifica azienda</DialogTitle>
            <DialogDescription className="text-sm text-gray-500">
              Aggiorna anagrafica e referenti. Le modifiche si riflettono nelle
              collaborazioni collegate.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={onSubmit} className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor={nameId} className="text-gray-700">
                Nome *
              </Label>
              <Input
                id={nameId}
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                minLength={1}
                maxLength={200}
                autoComplete="organization"
                disabled={pending}
                className="border-gray-200 bg-white text-gray-900"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-brand-sector" className="text-gray-700">
                Settore
              </Label>
              <Input
                id="edit-brand-sector"
                value={sector}
                onChange={(e) => setSector(e.target.value)}
                disabled={pending}
                className="border-gray-200 bg-white text-gray-900"
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <Label className="text-gray-700">Contatti</Label>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-8 gap-1 text-xs text-blue-600"
                  onClick={addPerson}
                  disabled={pending}
                >
                  <UserPlus className="size-3.5" />
                  Aggiungi referente
                </Button>
              </div>
              <ul className="space-y-3">
                {people.map((p, i) => (
                  <li
                    key={i}
                    className={cn(
                      "rounded-2xl border border-gray-100 bg-gray-50/80 p-3",
                      people.length > 1 && "relative pr-2"
                    )}
                  >
                    {people.length > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="absolute right-1.5 top-1.5 h-7 w-7 text-gray-400 hover:text-red-600"
                        onClick={() => removePerson(i)}
                        disabled={pending}
                        aria-label="Rimuovi referente"
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    )}
                    <p className="mb-2 text-xs font-medium text-gray-500">
                      Referente {i + 1}
                    </p>
                    <div className="grid gap-2 sm:grid-cols-2">
                      <div className="space-y-1">
                        <Label className="text-[11px] text-gray-500">Nome</Label>
                        <Input
                          value={p.firstName}
                          onChange={(e) =>
                            setPerson(i, { firstName: e.target.value })
                          }
                          disabled={pending}
                          className="h-8 border-gray-200 bg-white text-sm text-gray-900"
                          autoComplete="given-name"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[11px] text-gray-500">Cognome</Label>
                        <Input
                          value={p.lastName}
                          onChange={(e) =>
                            setPerson(i, { lastName: e.target.value })
                          }
                          disabled={pending}
                          className="h-8 border-gray-200 bg-white text-sm text-gray-900"
                          autoComplete="family-name"
                        />
                      </div>
                    </div>
                    <div className="mt-2 space-y-1">
                      <Label className="text-[11px] text-gray-500">Email</Label>
                      <Input
                        value={p.email}
                        onChange={(e) => setPerson(i, { email: e.target.value })}
                        type="email"
                        inputMode="email"
                        disabled={pending}
                        className="h-8 border-gray-200 bg-white text-sm text-gray-900"
                        autoComplete="email"
                      />
                    </div>
                    <div className="mt-2 space-y-1">
                      <Label className="text-[11px] text-gray-500">
                        WhatsApp (numero o link)
                      </Label>
                      <Input
                        value={p.whatsapp}
                        onChange={(e) =>
                          setPerson(i, { whatsapp: e.target.value })
                        }
                        disabled={pending}
                        placeholder="+39… oppure link wa.me"
                        className="h-8 border-gray-200 bg-white text-sm text-gray-900"
                      />
                    </div>
                  </li>
                ))}
              </ul>
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-brand-notes" className="text-gray-700">
                Note
              </Label>
              <Textarea
                id="edit-brand-notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                className="resize-none border-gray-200 bg-white text-gray-900"
                disabled={pending}
              />
            </div>
            {err && (
              <p className="text-sm text-red-600" role="alert">
                {err}
              </p>
            )}
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
                disabled={pending}
                className="border-gray-200 text-gray-800"
              >
                Annulla
              </Button>
              <Button type="submit" disabled={pending} className="rounded-full">
                {pending ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    Salvataggio…
                  </>
                ) : (
                  "Salva modifiche"
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
