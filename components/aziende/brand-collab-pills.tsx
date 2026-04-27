import type { BrandCollabLink } from "@/lib/data/fetchers";
import { cn } from "@/lib/utils";
import Link from "next/link";

type Props = {
  items: BrandCollabLink[];
  /** Testo se non ci sono collaborazioni (default trattino) */
  emptyLabel?: string;
};

export function BrandCollabPills({ items, emptyLabel = "—" }: Props) {
  if (items.length === 0) {
    return <span className="text-sm text-gray-400">{emptyLabel}</span>;
  }
  return (
    <div className="flex max-w-md flex-wrap content-start gap-1.5">
      {items.map((c) => (
        <Link
          key={c.id}
          href={`/collaborations/${c.id}`}
          className={cn(
            "inline-flex max-w-[min(12rem,100%)] min-w-0 items-center rounded-full border border-gray-200/90 bg-gray-50/90 px-2.5 py-0.5 text-left text-xs font-medium text-gray-800",
            "transition-colors hover:border-gray-300 hover:bg-gray-100"
          )}
          title={c.title}
        >
          <span className="min-w-0 flex-1 truncate">{c.title}</span>
        </Link>
      ))}
    </div>
  );
}
