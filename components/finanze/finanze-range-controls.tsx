"use client";

import { YouTubeSyncButton } from "@/components/youtube-sync-button";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

type Props = {
  initialStartDate?: string;
  initialEndDate?: string;
};

export function FinanzeRangeControls({ initialStartDate = "", initialEndDate = "" }: Props) {
  const router = useRouter();
  const [startDate, setStartDate] = useState(initialStartDate);
  const [endDate, setEndDate] = useState(initialEndDate);

  const toYmdLocal = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
      d.getDate()
    ).padStart(2, "0")}`;

  const pushRange = (nextStart: string, nextEnd: string) => {
    const sp = new URLSearchParams();
    if (nextStart) sp.set("startDate", nextStart);
    if (nextEnd) sp.set("endDate", nextEnd);
    const qs = sp.toString();
    router.replace(qs ? `/finanze?${qs}` : "/finanze");
    router.refresh();
  };

  const setPreset = (days: number) => {
    const end = new Date();
    const start = new Date(end);
    start.setDate(end.getDate() - days + 1);
    const s = toYmdLocal(start);
    const e = toYmdLocal(end);
    setStartDate(s);
    setEndDate(e);
    pushRange(s, e);
  };

  const setYearToDate = () => {
    const now = new Date();
    const start = new Date(now.getFullYear(), 0, 1);
    const s = toYmdLocal(start);
    const e = toYmdLocal(now);
    setStartDate(s);
    setEndDate(e);
    pushRange(s, e);
  };

  const jumpMonth = (delta: number) => {
    const anchorRaw = startDate || endDate || new Date().toISOString().slice(0, 10);
    const anchor = new Date(`${anchorRaw}T12:00:00`);
    const first = new Date(anchor.getFullYear(), anchor.getMonth() + delta, 1);
    const last = new Date(anchor.getFullYear(), anchor.getMonth() + delta + 1, 0);
    const s = toYmdLocal(first);
    const e = toYmdLocal(last);
    setStartDate(s);
    setEndDate(e);
    pushRange(s, e);
  };

  const monthLabel = (() => {
    const anchorRaw = startDate || endDate || new Date().toISOString().slice(0, 10);
    const d = new Date(`${anchorRaw}T12:00:00`);
    return d.toLocaleDateString("it-IT", { month: "long", year: "numeric" });
  })();

  const applyRange = () => {
    pushRange(startDate, endDate);
  };

  return (
    <div className="w-full rounded-2xl border border-gray-200/80 bg-white p-3 shadow-sm">
      <p className="mb-2 text-xs font-medium uppercase tracking-wide text-gray-400">
        Range Dati
      </p>
      <div className="grid gap-2">
        <div className="flex flex-wrap gap-1.5">
          <Button
            type="button"
            variant="outline"
            className="h-7 rounded-full border-gray-200 px-2.5 text-[11px]"
            onClick={() => setPreset(7)}
          >
            Ultima settimana
          </Button>
          <Button
            type="button"
            variant="outline"
            className="h-7 rounded-full border-gray-200 px-2.5 text-[11px]"
            onClick={() => setPreset(30)}
          >
            Ultimo mese
          </Button>
          <Button
            type="button"
            variant="outline"
            className="h-7 rounded-full border-gray-200 px-2.5 text-[11px]"
            onClick={() => setPreset(365)}
          >
            Ultimo anno
          </Button>
          <Button
            type="button"
            variant="outline"
            className="h-7 rounded-full border-gray-200 px-2.5 text-[11px]"
            onClick={setYearToDate}
          >
            Anno in corso
          </Button>
        </div>
        <div className="flex items-center justify-between rounded-xl border border-gray-100 bg-gray-50/70 px-2 py-1">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-gray-500"
            onClick={() => jumpMonth(-1)}
            aria-label="Mese precedente"
          >
            <ChevronLeft className="size-4" />
          </Button>
          <p className="text-xs font-medium capitalize text-gray-700">{monthLabel}</p>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-gray-500"
            onClick={() => jumpMonth(1)}
            aria-label="Mese successivo"
          >
            <ChevronRight className="size-4" />
          </Button>
        </div>
        <Input
          type="date"
          value={startDate}
          onChange={(e) => setStartDate(e.target.value)}
          className="h-8 border-gray-200 bg-white text-xs"
        />
        <Input
          type="date"
          value={endDate}
          onChange={(e) => setEndDate(e.target.value)}
          className="h-8 border-gray-200 bg-white text-xs"
        />
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            className="h-8 rounded-full border-gray-200 px-3 text-xs"
            onClick={applyRange}
          >
            Applica filtro
          </Button>
          <YouTubeSyncButton
            className="h-8 rounded-full border-gray-200 px-3 text-xs"
            label="Sync YouTube"
            startDate={startDate || undefined}
            endDate={endDate || undefined}
          />
        </div>
      </div>
    </div>
  );
}
