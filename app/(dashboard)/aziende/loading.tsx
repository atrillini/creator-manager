import { Skeleton } from "@/components/ui/skeleton";

export default function AziendeLoading() {
  return (
    <div>
      <div className="mb-6 flex flex-col gap-3 sm:mb-8 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-2">
          <Skeleton className="h-8 w-40" />
          <Skeleton className="h-4 w-[32rem] max-w-[85vw]" />
        </div>
        <Skeleton className="h-10 w-full sm:w-44" />
      </div>
      <section className="overflow-hidden rounded-3xl bg-white p-4 shadow-[0_8px_30px_rgba(0,0,0,0.04)]">
        <div className="mb-3 grid grid-cols-[1.1fr_.8fr_.8fr_.8fr_auto] gap-3">
          <Skeleton className="h-4 w-20 rounded-md" />
          <Skeleton className="h-4 w-20 rounded-md" />
          <Skeleton className="h-4 w-28 rounded-md" />
          <Skeleton className="h-4 w-28 rounded-md" />
          <Skeleton className="ml-auto h-4 w-12 rounded-md" />
        </div>
        <div className="space-y-2">
          <Skeleton className="h-12 w-full rounded-xl" />
          <Skeleton className="h-12 w-full rounded-xl" />
          <Skeleton className="h-12 w-full rounded-xl" />
          <Skeleton className="h-12 w-full rounded-xl" />
          <Skeleton className="h-12 w-full rounded-xl" />
          <Skeleton className="h-12 w-full rounded-xl" />
        </div>
      </section>
    </div>
  );
}
