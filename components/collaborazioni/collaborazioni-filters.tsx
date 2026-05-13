"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { CalendarRange, Search, X } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useId, useMemo, useState, useTransition } from "react";

export type RangePreset =
  | "current_year"
  | "prev_year"
  | "last90"
  | "all"
  | "custom";

type Props = {
  /** Conteggio dei record dopo i filtri (lato server). */
  filteredCount: number;
  /** Totale record dell'utente, senza filtri (lato server). */
  totalCount: number;
};

function parseRange(raw: string | null): RangePreset {
  if (raw === "prev_year" || raw === "last90" || raw === "all" || raw === "custom") {
    return raw;
  }
  return "current_year";
}

export function CollaborazioniFilters({ filteredCount, totalCount }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();
  const searchId = useId();

  const currentRange = parseRange(searchParams.get("range"));
  const currentFrom = searchParams.get("from") ?? "";
  const currentTo = searchParams.get("to") ?? "";
  const currentQuery = searchParams.get("q") ?? "";

  const [query, setQuery] = useState(currentQuery);
  const [customOpen, setCustomOpen] = useState(false);
  const [customFrom, setCustomFrom] = useState(currentFrom);
  const [customTo, setCustomTo] = useState(currentTo);

  useEffect(() => {
    setQuery(currentQuery);
  }, [currentQuery]);

  useEffect(() => {
    setCustomFrom(currentFrom);
    setCustomTo(currentTo);
  }, [currentFrom, currentTo]);

  const navigate = (params: URLSearchParams) => {
    const qs = params.toString();
    startTransition(() => {
      router.replace(qs ? `/collaborazioni?${qs}` : "/collaborazioni");
      router.refresh();
    });
  };

  const setPreset = (preset: RangePreset) => {
    const sp = new URLSearchParams(searchParams.toString());
    sp.delete("from");
    sp.delete("to");
    if (preset === "current_year") {
      sp.delete("range");
    } else {
      sp.set("range", preset);
    }
    navigate(sp);
  };

  const applyCustomRange = () => {
    const sp = new URLSearchParams(searchParams.toString());
    sp.set("range", "custom");
    if (customFrom) sp.set("from", customFrom);
    else sp.delete("from");
    if (customTo) sp.set("to", customTo);
    else sp.delete("to");
    setCustomOpen(false);
    navigate(sp);
  };

  const clearAll = () => {
    const sp = new URLSearchParams();
    navigate(sp);
  };

  const submitQuery = (next: string) => {
    const sp = new URLSearchParams(searchParams.toString());
    const trimmed = next.trim();
    if (trimmed) sp.set("q", trimmed);
    else sp.delete("q");
    navigate(sp);
  };

  const yearNow = new Date().getFullYear();
  const yearPrev = yearNow - 1;

  const customLabel = useMemo(() => {
    if (currentRange !== "custom") return "Personalizzato";
    if (currentFrom && currentTo) {
      return `${currentFrom} → ${currentTo}`;
    }
    if (currentFrom) return `Dal ${currentFrom}`;
    if (currentTo) return `Fino al ${currentTo}`;
    return "Personalizzato";
  }, [currentRange, currentFrom, currentTo]);

  const hasActiveFilter =
    currentRange !== "current_year" || currentQuery.length > 0;

  const chipClass = (active: boolean) =>
    cn(
      "h-7 rounded-full border-gray-200 px-2.5 text-[11px] transition",
      active && "border-blue-500 bg-blue-50 text-blue-700 hover:bg-blue-100"
    );

  return (
    <div className="mb-3 flex flex-wrap items-center gap-2">
      <div className="flex flex-wrap items-center gap-1.5">
        <Button
          type="button"
          variant="outline"
          className={chipClass(currentRange === "current_year")}
          onClick={() => setPreset("current_year")}
          disabled={pending}
        >
          {yearNow}
        </Button>
        <Button
          type="button"
          variant="outline"
          className={chipClass(currentRange === "prev_year")}
          onClick={() => setPreset("prev_year")}
          disabled={pending}
        >
          {yearPrev}
        </Button>
        <Button
          type="button"
          variant="outline"
          className={chipClass(currentRange === "last90")}
          onClick={() => setPreset("last90")}
          disabled={pending}
        >
          Ultimi 90 gg
        </Button>
        <Button
          type="button"
          variant="outline"
          className={chipClass(currentRange === "all")}
          onClick={() => setPreset("all")}
          disabled={pending}
        >
          Tutto
        </Button>
        <Popover open={customOpen} onOpenChange={setCustomOpen}>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="outline"
              className={cn(
                "h-7 gap-1 rounded-full border-gray-200 px-2.5 text-[11px]",
                currentRange === "custom" &&
                  "border-blue-500 bg-blue-50 text-blue-700"
              )}
              disabled={pending}
            >
              <CalendarRange className="size-3.5" />
              {customLabel}
            </Button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-72 space-y-3">
            <div className="space-y-1">
              <Label htmlFor="cust-from" className="text-xs text-gray-500">
                Dal
              </Label>
              <Input
                id="cust-from"
                type="date"
                value={customFrom}
                max={customTo || undefined}
                onChange={(e) => setCustomFrom(e.target.value)}
                className="h-8 border-gray-200 bg-white text-xs"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="cust-to" className="text-xs text-gray-500">
                Al
              </Label>
              <Input
                id="cust-to"
                type="date"
                value={customTo}
                min={customFrom || undefined}
                onChange={(e) => setCustomTo(e.target.value)}
                className="h-8 border-gray-200 bg-white text-xs"
              />
              <p className="text-[11px] text-gray-500">
                Filtro applicato alla data di creazione del deal.
              </p>
            </div>
            <div className="flex justify-between gap-2 pt-1">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="text-xs text-gray-500 hover:text-gray-700"
                onClick={() => {
                  setCustomFrom("");
                  setCustomTo("");
                }}
              >
                Reset
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={(e) => {
                  e.preventDefault();
                  applyCustomRange();
                }}
                disabled={!customFrom && !customTo}
                className="h-8 rounded-full px-3 text-xs"
              >
                Applica
              </Button>
            </div>
          </PopoverContent>
        </Popover>
      </div>

      <div className="relative ml-auto flex min-w-[12rem] flex-1 items-center sm:flex-initial">
        <Search className="pointer-events-none absolute left-2.5 size-3.5 text-gray-400" />
        <Input
          id={searchId}
          type="search"
          value={query}
          placeholder="Cerca per titolo o brand…"
          aria-label="Cerca collaborazioni"
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              submitQuery(query);
            }
          }}
          onBlur={() => {
            if (query.trim() !== currentQuery) submitQuery(query);
          }}
          className="h-8 rounded-full border-gray-200 bg-white pl-8 pr-3 text-xs"
        />
      </div>

      <div className="flex items-center gap-2 text-xs text-gray-500">
        <span className="tabular-nums">
          Mostrate <span className="font-medium text-gray-700">{filteredCount}</span>{" "}
          di <span className="font-medium text-gray-700">{totalCount}</span>
        </span>
        {hasActiveFilter && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 gap-1 rounded-full px-2 text-[11px] text-gray-500 hover:text-gray-700"
            onClick={clearAll}
            disabled={pending}
          >
            <X className="size-3" />
            Pulisci filtri
          </Button>
        )}
      </div>
    </div>
  );
}
