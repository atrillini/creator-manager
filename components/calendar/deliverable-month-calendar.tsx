"use client";

import { statusDotClass, statusLabelIt, eventRowClassName } from "@/lib/calendar/deliverable-status";
import type { CalendarDeliverableItem } from "@/lib/data/calendar-deliverables";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { CalendarDays, ChevronLeft, ChevronRight, ExternalLink } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";

const WEEKDAYS = ["Lun", "Mar", "Mer", "Gio", "Ven", "Sab", "Dom"] as const;

function localDateKey(d: Date) {
  const y = d.getFullYear();
  const m = d.getMonth() + 1;
  const day = d.getDate();
  return `${y}-${String(m).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function buildMonthGrid(year: number, month: number) {
  const firstDow = (new Date(year, month, 1).getDay() + 6) % 7;
  const n = new Date(year, month + 1, 0).getDate();
  const prevN = new Date(year, month, 0).getDate();
  const cells: { inMonth: boolean; date: Date }[] = [];
  for (let i = 0; i < firstDow; i++) {
    const day = prevN - firstDow + i + 1;
    cells.push({ inMonth: false, date: new Date(year, month - 1, day) });
  }
  for (let d = 1; d <= n; d++) {
    cells.push({ inMonth: true, date: new Date(year, month, d) });
  }
  let next = 1;
  while (cells.length % 7 !== 0) {
    cells.push({ inMonth: false, date: new Date(year, month + 1, next) });
    next += 1;
  }
  return cells;
}

type Props = {
  items: CalendarDeliverableItem[];
};

export function DeliverableMonthCalendar({ items }: Props) {
  const now = new Date();
  const [view, setView] = useState(() => ({
    y: now.getFullYear(),
    m: now.getMonth(),
  }));

  const byDate = useMemo(() => {
    const m = new Map<string, CalendarDeliverableItem[]>();
    for (const it of items) {
      const k = it.publishDate;
      const list = m.get(k) ?? [];
      list.push(it);
      m.set(k, list);
    }
    return m;
  }, [items]);

  const grid = useMemo(
    () => buildMonthGrid(view.y, view.m),
    [view.y, view.m]
  );

  const monthTitle = new Date(view.y, view.m, 1).toLocaleDateString("it-IT", {
    month: "long",
    year: "numeric",
  });

  const goPrev = () => {
    setView((v) => {
      const d = new Date(v.y, v.m - 1, 1);
      return { y: d.getFullYear(), m: d.getMonth() };
    });
  };
  const goNext = () => {
    setView((v) => {
      const d = new Date(v.y, v.m + 1, 1);
      return { y: d.getFullYear(), m: d.getMonth() };
    });
  };
  const goToday = () => {
    const t = new Date();
    setView({ y: t.getFullYear(), m: t.getMonth() });
  };

  const todayKey = localDateKey(new Date());

  return (
    <div
      className="w-full max-w-5xl rounded-3xl bg-white p-4 text-gray-900 shadow-[0_1px_3px_rgba(0,0,0,0.04),0_4px_24px_rgba(0,0,0,0.04)] sm:p-6"
      data-calendar-root
    >
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="flex min-w-0 items-center gap-2 text-base font-semibold tracking-tight text-gray-800 sm:text-lg">
          <CalendarDays className="size-4 shrink-0 text-blue-500" aria-hidden />
          <span className="truncate [text-transform:capitalize]">{monthTitle}</span>
        </h2>
        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={goPrev}
            className="h-8 w-8 text-gray-500"
            aria-label="Mese precedente"
          >
            <ChevronLeft className="size-4" />
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={goToday}
            className="rounded-full border-0 bg-gray-100/80 text-gray-800 shadow-sm hover:bg-gray-100"
          >
            Oggi
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={goNext}
            className="h-8 w-8 text-gray-500"
            aria-label="Mese successivo"
          >
            <ChevronRight className="size-4" />
          </Button>
        </div>
      </div>

      {items.length === 0 && (
        <p className="mb-3 rounded-2xl bg-gray-50/80 px-3 py-2 text-sm text-gray-500">
          Nessun contenuto con data di pubblicazione. Aggiungi scadenze dalla scheda di una
          collaborazione.
        </p>
      )}

      <div
        className="grid grid-cols-7 overflow-hidden rounded-2xl border border-white/40 bg-gray-100/20 p-px shadow-inner shadow-white/40"
        role="grid"
        aria-label="Calendario dei deliverable"
      >
        {WEEKDAYS.map((d) => (
          <div
            key={d}
            className="bg-white/50 py-2.5 text-center text-[11px] font-medium uppercase tracking-wide text-gray-400"
            role="columnheader"
          >
            {d}
          </div>
        ))}

        {grid.map((cell) => {
          const key = localDateKey(cell.date);
          const dayList = byDate.get(key) ?? [];
          const isToday = key === todayKey;
          return (
            <div
              key={key + (cell.inMonth ? "" : "-faded")}
              className={cn(
                "min-h-[4.5rem] border border-white/25 p-0.5 sm:min-h-[5.5rem] sm:p-1",
                !cell.inMonth && "bg-gray-50/50 text-gray-400",
                cell.inMonth && "bg-white/90"
              )}
              role="gridcell"
            >
              <div className="flex h-full min-h-0 flex-col">
                <span
                  className={cn(
                    "mb-0.5 flex h-5 w-5 items-center justify-center text-[10px] font-medium sm:text-xs",
                    !cell.inMonth && "text-gray-400",
                    isToday && cell.inMonth
                      && "font-semibold text-white"
                  )}
                >
                  {isToday && cell.inMonth ? (
                    <span className="flex size-6 items-center justify-center rounded-full bg-blue-500 text-[10px] text-white">
                      {cell.date.getDate()}
                    </span>
                  ) : (
                    <span className="text-gray-600 tabular-nums">
                      {cell.date.getDate()}
                    </span>
                  )}
                </span>
                <ul className="min-w-0 space-y-0.5 pl-0">
                  {dayList.slice(0, 3).map((ev) => (
                    <li key={ev.id} className="min-w-0">
                      <EventChip ev={ev} />
                    </li>
                  ))}
                  {dayList.length > 3 && (
                    <li className="pl-0.5 text-[9px] text-gray-400 sm:text-[10px]">
                      +{dayList.length - 3} altri
                    </li>
                  )}
                </ul>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function EventChip({ ev }: { ev: CalendarDeliverableItem }) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            eventRowClassName(ev.status),
            "max-w-full cursor-pointer shadow-[0_1px_2px_rgba(0,0,0,0.04)]"
          )}
          title={ev.displayLabel}
        >
          <span
            className={cn(
              "mt-0.5 size-1.5 shrink-0 rounded-full",
              statusDotClass(ev.status)
            )}
            aria-hidden
          />
          <span className="min-w-0 flex-1 truncate text-left">{ev.displayLabel}</span>
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-[min(100vw-1.5rem,20rem)]" align="start" sideOffset={6}>
        <div className="space-y-1">
          <p className="text-[11px] font-medium uppercase tracking-tight text-gray-400">
            {statusLabelIt(ev.status)}
          </p>
          <p className="text-base font-semibold leading-tight text-gray-900">
            {ev.brandName}
          </p>
          <p className="text-sm text-gray-600">{ev.type}</p>
        </div>
        <p className="mt-2 text-xs text-gray-500">
          {new Date(ev.publishDate + "T12:00:00").toLocaleDateString("it-IT", {
            weekday: "long",
            day: "numeric",
            month: "long",
            year: "numeric",
          })}
        </p>
        <span className="text-xs text-gray-500">{ev.status}</span>
        {ev.contentUrl ? (
          <Button asChild variant="outline" className="mt-3 w-full rounded-full">
            <a
              href={ev.contentUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2"
            >
              <ExternalLink className="size-3.5 shrink-0" aria-hidden />
              Apri contenuto pubblicato
            </a>
          </Button>
        ) : null}
        <Button
          asChild
          className={cn("w-full rounded-full", ev.contentUrl ? "mt-2" : "mt-4")}
        >
          <Link href={`/collaborations/${ev.collaborationId}`}>
            Apri collaborazione
          </Link>
        </Button>
      </PopoverContent>
    </Popover>
  );
}
