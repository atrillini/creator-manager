"use client";

import { createBrand } from "@/lib/actions/brand";
import {
  emptyBrandContact,
  type BrandContact,
} from "@/lib/brand-contacts";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { Loader2, Plus, Trash2, UserPlus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useId, useState, useTransition } from "react";

export function CreateBrandDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const [people, setPeople] = useState<BrandContact[]>([emptyBrandContact()]);
  const nameId = useId();

  function setPerson(
    index: number,
    patch: Partial<BrandContact>
  ) {
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
    const form = e.currentTarget;
    const name = (form.elements.namedItem("name") as HTMLInputElement).value;
    const sector = (form.elements.namedItem("sector") as HTMLInputElement).value;
    const notes = (form.elements.namedItem("notes") as HTMLTextAreaElement)
      .value;
    start(() => {
      void (async () => {
        const res = await createBrand({
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
        form.reset();
        setPeople([emptyBrandContact()]);
        router.refresh();
      })();
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" size="sm" className="gap-1">
          <Plus className="size-4" />
          Aggiungi azienda
        </Button>
      </DialogTrigger>
      <DialogContent
        onPointerDownOutside={(e) => pending && e.preventDefault()}
        onEscapeKeyDown={(e) => pending && e.preventDefault()}
        aria-busy={pending}
        className="max-h-[min(90vh,720px)] max-w-lg overflow-y-auto border border-gray-200/80 bg-white text-gray-900"
      >
        <DialogHeader>
          <DialogTitle className="text-lg text-gray-900">Nuova azienda</DialogTitle>
          <DialogDescription className="text-sm text-gray-500">
            Salva il brand in Supabase. Puoi aggiungere più referenti con contatti
            strutturati.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-3">
          <div className="space-y-2">
            <Label htmlFor={nameId} className="text-gray-700">
              Nome *
            </Label>
            <Input
              id={nameId}
              name="name"
              required
              minLength={1}
              maxLength={200}
              autoComplete="organization"
              disabled={pending}
              className="border-gray-200 bg-white text-gray-900"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="brand-sector" className="text-gray-700">
              Settore
            </Label>
            <Input
              id="brand-sector"
              name="sector"
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
            <Label htmlFor="brand-notes" className="text-gray-700">
              Note
            </Label>
            <Textarea
              id="brand-notes"
              name="notes"
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
                "Crea"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
