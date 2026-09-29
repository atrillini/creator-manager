"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { Briefcase, Loader2, Sparkles } from "lucide-react";
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
import { applyBrandSuggestions, applyCollaborationLinks } from "@/lib/actions/inbox-suggestions";
import type { BrandSuggestion, CollaborationLinkSuggestion } from "@/lib/data/inbox-suggestions";
import { cn } from "@/lib/utils";

type Props = {
  brands: BrandSuggestion[];
  links: CollaborationLinkSuggestion[];
};

type Tab = "brand" | "collab";

const COLLAB_STATUS_LABEL: Record<string, string> = {
  proposta: "proposta",
  "in valutazione": "in valutazione",
  accettata: "accettata",
  completata: "completata",
  rifiutata: "rifiutata",
};

function shortDate(iso: string | null) {
  return iso ? new Date(iso).toLocaleDateString("it-IT", { day: "numeric", month: "short", year: "2-digit" }) : "";
}

export function InboxSuggestionsDialog({ brands, links }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<Tab>(brands.length ? "brand" : "collab");
  const [pending, start] = useTransition();
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null);

  // Brand: selezionati di default quelli non composti solo da email di massa.
  const [brandChecked, setBrandChecked] = useState<Set<string>>(
    () => new Set(brands.filter((b) => !b.lowQuality).map((b) => b.key))
  );
  const [brandNames, setBrandNames] = useState<Record<string, string>>({});
  // Collegamenti: selezionati di default quelli indicati dall'AI.
  const [linkChecked, setLinkChecked] = useState<Set<string>>(
    () => new Set(links.flatMap((l) => l.threads.filter((t) => t.source === "ai").map((t) => `${l.collaborationId}:${t.id}`)))
  );

  const total = brands.length + links.reduce((a, l) => a + l.threads.length, 0);
  const selectedBrandThreads = useMemo(
    () => brands.filter((b) => brandChecked.has(b.key)).reduce((a, b) => a + b.threadIds.length, 0),
    [brands, brandChecked]
  );

  if (total === 0 && !open) return null;

  const toggle = <T,>(set: Set<T>, value: T) => {
    const next = new Set(set);
    if (next.has(value)) next.delete(value);
    else next.add(value);
    return next;
  };

  const applyBrands = () => {
    setMessage(null);
    start(async () => {
      const res = await applyBrandSuggestions(
        brands
          .filter((b) => brandChecked.has(b.key))
          .map((b) => ({
            name: brandNames[b.key]?.trim() || b.name,
            threadIds: b.threadIds,
            domains: b.domains,
            contact: b.contact,
          }))
      );
      if (!res.ok) {
        setMessage({ text: res.error, error: true });
        return;
      }
      setMessage({
        text: `${res.created} aziende create, ${res.linked} conversazioni associate. I domini sono stati salvati per le prossime email.`,
        error: false,
      });
      router.refresh();
    });
  };

  const applyLinks = () => {
    setMessage(null);
    start(async () => {
      const res = await applyCollaborationLinks(
        [...linkChecked].map((k) => {
          const [collaborationId, threadId] = k.split(":");
          return { collaborationId: collaborationId!, threadId: threadId! };
        })
      );
      if (!res.ok) {
        setMessage({ text: res.error, error: true });
        return;
      }
      setMessage({ text: `${res.linked} conversazioni collegate alle collaborazioni.`, error: false });
      router.refresh();
    });
  };

  return (
    <>
      <Button
        type="button"
        size="sm"
        variant="outline"
        className="h-auto min-h-7 max-w-full gap-1.5 whitespace-normal rounded-full border-violet-200 bg-violet-50 px-2.5 py-1 text-left text-xs text-violet-700 hover:bg-violet-100"
        onClick={() => {
          setMessage(null);
          setOpen(true);
        }}
      >
        <Sparkles className="size-3.5" />
        Suggerimenti AI ({brands.length} brand · {links.reduce((a, l) => a + l.threads.length, 0)} collegamenti)
      </Button>
      <Dialog open={open} onOpenChange={(o) => !pending && setOpen(o)}>
        <DialogContent className="flex max-h-[min(90vh,820px)] max-w-3xl flex-col border border-gray-200/80 bg-white text-gray-900">
          <DialogHeader>
            <DialogTitle>Suggerimenti dall&apos;analisi AI</DialogTitle>
            <DialogDescription className="text-sm text-gray-500">
              Controlla, togli la spunta a ciò che non ti convince e conferma. Niente viene creato finché non premi il
              pulsante in basso.
            </DialogDescription>
          </DialogHeader>

          <div className="flex gap-1.5">
            {(
              [
                ["brand", `Brand da creare (${brands.length})`],
                ["collab", `Collegamenti a collaborazioni (${links.reduce((a, l) => a + l.threads.length, 0)})`],
              ] as [Tab, string][]
            ).map(([t, label]) => (
              <button
                key={t}
                type="button"
                onClick={() => setTab(t)}
                className={cn(
                  "rounded-full px-3 py-1 text-xs transition-colors",
                  tab === t ? "bg-gray-900 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                )}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto pr-1">
            {tab === "brand" ? (
              brands.length === 0 ? (
                <p className="py-8 text-center text-sm text-gray-400">Nessun brand da creare.</p>
              ) : (
                <ul className="divide-y divide-gray-100">
                  {brands.map((b) => {
                    const checked = brandChecked.has(b.key);
                    return (
                      <li key={b.key} className={cn("flex gap-3 py-2.5", !checked && "opacity-60")}>
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => setBrandChecked((s) => toggle(s, b.key))}
                          className="mt-2 size-4 shrink-0 accent-gray-900"
                          aria-label={`Crea ${b.name}`}
                        />
                        <div className="min-w-0 flex-1 space-y-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <Input
                              value={brandNames[b.key] ?? b.name}
                              onChange={(e) => setBrandNames((n) => ({ ...n, [b.key]: e.target.value }))}
                              className="h-8 w-56 border-gray-200 text-sm font-medium"
                              aria-label="Nome azienda"
                            />
                            <span className="text-xs text-gray-500">
                              {b.threadIds.length} conversazion{b.threadIds.length === 1 ? "e" : "i"} · ultima{" "}
                              {shortDate(b.lastMessageAt)}
                            </span>
                            {b.viaAgency ? (
                              <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-1.5 py-px text-[10px] text-gray-600">
                                <Briefcase className="size-2.5" />
                                solo tramite agenzia
                              </span>
                            ) : null}
                            {b.lowQuality ? (
                              <span className="rounded-full bg-gray-50 px-1.5 py-px text-[10px] text-gray-400">
                                email di massa
                              </span>
                            ) : null}
                          </div>
                          <p className="truncate text-xs text-gray-500" title={b.subjects.join("\n")}>
                            {b.subjects.join(" · ")}
                          </p>
                          {b.domains.length || b.contact ? (
                            <p className="text-[11px] text-gray-400">
                              {b.domains.length ? `Domini: ${b.domains.join(", ")}` : ""}
                              {b.domains.length && b.contact ? " · " : ""}
                              {b.contact ? `Referente: ${[b.contact.name, b.contact.email].filter(Boolean).join(" ")}` : ""}
                            </p>
                          ) : null}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )
            ) : links.length === 0 ? (
              <p className="py-8 text-center text-sm text-gray-400">Nessun collegamento da proporre.</p>
            ) : (
              <div className="space-y-4">
                {links.map((l) => (
                  <section key={l.collaborationId}>
                    <p className="text-sm font-medium text-gray-900">
                      {l.title}
                      <span className="ml-1.5 text-xs font-normal text-gray-500">
                        {l.brandName} · {COLLAB_STATUS_LABEL[l.status] ?? l.status}
                      </span>
                    </p>
                    <ul className="mt-1 space-y-1">
                      {l.threads.map((t) => {
                        const k = `${l.collaborationId}:${t.id}`;
                        return (
                          <li key={k}>
                            <label className="flex cursor-pointer items-center gap-2 rounded-lg px-1.5 py-1 text-xs hover:bg-gray-50">
                              <input
                                type="checkbox"
                                checked={linkChecked.has(k)}
                                onChange={() => setLinkChecked((s) => toggle(s, k))}
                                className="size-3.5 shrink-0 accent-gray-900"
                              />
                              <span className="min-w-0 flex-1 truncate text-gray-700">{t.subject}</span>
                              <span className="shrink-0 text-gray-400">{shortDate(t.lastMessageAt)}</span>
                              <span
                                className={cn(
                                  "shrink-0 rounded-full px-1.5 py-px text-[10px]",
                                  t.source === "ai" ? "bg-violet-50 text-violet-700" : "bg-gray-100 text-gray-500"
                                )}
                                title={
                                  t.source === "ai"
                                    ? "L'AI ha riconosciuto questo deal nella conversazione"
                                    : "Stesso brand, conversazione vicina alla data di creazione del deal"
                                }
                              >
                                {t.source === "ai" ? "AI" : "stesso brand"}
                              </span>
                            </label>
                          </li>
                        );
                      })}
                    </ul>
                  </section>
                ))}
              </div>
            )}
          </div>

          {message ? (
            <p className={cn("text-sm", message.error ? "text-red-600" : "text-emerald-700")}>{message.text}</p>
          ) : null}
          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={pending}>
              Chiudi
            </Button>
            {tab === "brand" ? (
              <Button type="button" onClick={applyBrands} disabled={pending || brandChecked.size === 0} className="rounded-full">
                {pending ? <Loader2 className="size-4 animate-spin" /> : null}
                Crea {brandChecked.size} aziende e associa {selectedBrandThreads} conversazioni
              </Button>
            ) : (
              <Button type="button" onClick={applyLinks} disabled={pending || linkChecked.size === 0} className="rounded-full">
                {pending ? <Loader2 className="size-4 animate-spin" /> : null}
                Collega {linkChecked.size} conversazioni
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
