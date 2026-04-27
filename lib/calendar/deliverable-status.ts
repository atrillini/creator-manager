import { cn } from "@/lib/utils";

const STATUS_MAP: Record<
  string,
  { dot: string; soft: string; label: string }
> = {
  "da girare": {
    dot: "bg-amber-400",
    soft: "bg-amber-100/70",
    label: "Da girare",
  },
  girato: {
    dot: "bg-orange-400",
    soft: "bg-orange-100/80",
    label: "Girato",
  },
  "in montaggio": {
    dot: "bg-sky-500",
    soft: "bg-sky-100/80",
    label: "In montaggio",
  },
  "approvazione cliente": {
    dot: "bg-violet-500",
    soft: "bg-violet-100/80",
    label: "Approvazione cliente",
  },
  pubblicato: {
    dot: "bg-emerald-500",
    soft: "bg-emerald-100/80",
    label: "Pubblicato",
  },
};

export function deliverableStatusClass(status: string) {
  const s = STATUS_MAP[status];
  if (!s) {
    return {
      dot: "bg-gray-400",
      soft: "bg-gray-100/90",
      label: status,
    };
  }
  return s;
}

export function statusDotClass(status: string) {
  return deliverableStatusClass(status).dot;
}

export function statusRowSoftClass(status: string) {
  return deliverableStatusClass(status).soft;
}

export function statusLabelIt(status: string) {
  return deliverableStatusClass(status).label;
}

/** Pallet pastello sotto il testo (niente bordi duri) */
export function eventRowClassName(status: string) {
  return cn(
    "flex w-full min-w-0 items-center gap-1.5 rounded-lg px-1.5 py-1 text-left text-[10px] font-medium leading-tight text-gray-800 transition-[transform,box-shadow] hover:brightness-[0.99] sm:text-[11px]",
    deliverableStatusClass(status).soft,
    "shadow-[inset_0_0_0_1px_rgba(255,255,255,0.5)]"
  );
}
