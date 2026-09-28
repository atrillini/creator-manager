"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { SlidersHorizontal } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { InboxCounts, InboxTag } from "@/lib/data/inbox";
import { INBOX_VIEWS, type InboxView } from "@/lib/inbox/views";
import { INBOX_CATEGORIES, INBOX_CATEGORY_META } from "@/lib/inbox/constants";
import { inboxHref, type InboxParams } from "@/lib/inbox/url";
import { cn } from "@/lib/utils";

const ALL_BRANDS = "__all__";

type Props = {
  params: InboxParams;
  view: InboxView;
  counts: InboxCounts;
  tags: InboxTag[];
  brands: { id: string; name: string }[];
};

function NavItem({
  href,
  active,
  label,
  count,
  dotClass,
}: {
  href: string;
  active: boolean;
  label: string;
  count?: number;
  dotClass?: string;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "flex shrink-0 items-center justify-between gap-2 whitespace-nowrap rounded-xl px-3 py-2 text-sm transition-colors lg:px-2.5 lg:py-1.5",
        active ? "bg-gray-900 text-white" : "bg-white text-gray-600 hover:bg-white hover:text-gray-900 lg:bg-transparent"
      )}
    >
      <span className="flex min-w-0 items-center gap-2">
        {dotClass ? <span className={cn("size-2 shrink-0 rounded-full", dotClass)} /> : null}
        <span className="truncate">{label}</span>
      </span>
      {count ? (
        <span className={cn("text-xs tabular-nums", active ? "text-white/70" : "text-gray-400")}>{count}</span>
      ) : null}
    </Link>
  );
}

export function InboxFiltersPanel({ params, view, counts, tags, brands }: Props) {
  const router = useRouter();
  const [moreOpen, setMoreOpen] = useState(false);
  const reset = { before: null, t: null } as const;
  const activeExtra = [params.cat, params.brand, params.tag, params.unlinked].filter(Boolean).length;

  return (
    <nav className="space-y-3 lg:space-y-5" aria-label="Filtri inbox">
      {/* Telefono: viste in una riga scorrevole; desktop: colonna. */}
      <div className="-mx-4 flex gap-1.5 overflow-x-auto px-4 pb-1 [scrollbar-width:none] lg:mx-0 lg:block lg:space-y-0.5 lg:overflow-visible lg:px-0 lg:pb-0">
        {(Object.keys(INBOX_VIEWS) as InboxView[]).map((v) => (
          <NavItem
            key={v}
            href={inboxHref(params, { ...reset, q: null, view: v === "da_gestire" ? null : v })}
            active={view === v && !params.q}
            label={INBOX_VIEWS[v].label}
            count={v === "tutte" ? undefined : counts.views[v]}
          />
        ))}
        <button
          type="button"
          onClick={() => setMoreOpen((o) => !o)}
          aria-expanded={moreOpen}
          className={cn(
            "inline-flex shrink-0 items-center gap-1.5 rounded-xl px-3 py-2 text-sm lg:hidden",
            moreOpen || activeExtra ? "bg-gray-900 text-white" : "bg-white text-gray-600"
          )}
        >
          <SlidersHorizontal className="size-3.5" />
          Filtri{activeExtra ? ` (${activeExtra})` : ""}
        </button>
      </div>

      <div className={cn("space-y-5 rounded-2xl bg-white/70 p-3 lg:block lg:bg-transparent lg:p-0", !moreOpen && "hidden")}>
      <div className="space-y-0.5">
        <p className="px-2.5 pb-1 text-[11px] font-medium uppercase tracking-wide text-gray-400">Categorie</p>
        {INBOX_CATEGORIES.map((c) => (
          <NavItem
            key={c}
            href={inboxHref(params, { ...reset, cat: params.cat === c ? null : c })}
            active={params.cat === c}
            label={INBOX_CATEGORY_META[c].label}
            count={counts.categories[c]}
            dotClass={INBOX_CATEGORY_META[c].dotClassName}
          />
        ))}
        <NavItem
          href={inboxHref(params, { ...reset, unlinked: params.unlinked === "1" ? null : "1" })}
          active={params.unlinked === "1"}
          label="Senza brand"
          count={counts.unlinked}
          dotClass="bg-red-300"
        />
      </div>

      <div className="space-y-1.5">
        <p className="px-2.5 text-[11px] font-medium uppercase tracking-wide text-gray-400">Brand</p>
        <Select
          value={params.brand ?? ALL_BRANDS}
          onValueChange={(v) => router.push(inboxHref(params, { ...reset, brand: v === ALL_BRANDS ? null : v }))}
        >
          <SelectTrigger className="h-8 border-gray-200 bg-white text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_BRANDS}>Tutti i brand</SelectItem>
            {brands.map((b) => (
              <SelectItem key={b.id} value={b.id}>
                {b.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {tags.length > 0 ? (
        <div className="space-y-1.5">
          <p className="px-2.5 text-[11px] font-medium uppercase tracking-wide text-gray-400">Tag</p>
          <div className="flex flex-wrap gap-1 px-1">
            {tags.map((t) => (
              <Link
                key={t.id}
                href={inboxHref(params, { ...reset, tag: params.tag === t.id ? null : t.id })}
                className={cn(
                  "rounded-full px-2 py-0.5 text-[11px] transition-colors",
                  params.tag === t.id ? "bg-gray-900 text-white" : "bg-white text-gray-600 hover:bg-gray-100"
                )}
              >
                #{t.name}
              </Link>
            ))}
          </div>
        </div>
      ) : null}
      </div>
    </nav>
  );
}
