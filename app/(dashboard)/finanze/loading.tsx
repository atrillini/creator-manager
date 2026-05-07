import { Skeleton } from "@/components/ui/skeleton";

function SplitCardSkeleton() {
  return (
    <section className="rounded-3xl bg-white p-5 shadow-[0_8px_30px_rgba(0,0,0,0.04)]">
      <Skeleton className="h-3 w-36 rounded-md" />
      <Skeleton className="mt-2 h-9 w-32 rounded-lg" />
      <div className="mt-3 flex flex-wrap gap-1.5">
        <Skeleton className="h-6 w-24 rounded-full" />
        <Skeleton className="h-6 w-20 rounded-full" />
        <Skeleton className="h-6 w-28 rounded-full" />
      </div>
      <Skeleton className="mt-3 h-3 w-full rounded-full" />
    </section>
  );
}

function TableBlockSkeleton({ titleWidth = "w-52" }: { titleWidth?: string }) {
  return (
    <section className="overflow-hidden rounded-3xl bg-white p-4 shadow-[0_8px_30px_rgba(0,0,0,0.04)]">
      <Skeleton className={`mb-4 h-5 ${titleWidth} rounded-md`} />
      <div className="space-y-2">
        <Skeleton className="h-10 w-full rounded-xl" />
        <Skeleton className="h-10 w-full rounded-xl" />
        <Skeleton className="h-10 w-full rounded-xl" />
        <Skeleton className="h-10 w-full rounded-xl" />
        <Skeleton className="h-10 w-full rounded-xl" />
      </div>
    </section>
  );
}

export default function FinanzeLoading() {
  return (
    <div>
      <div className="mb-6 flex flex-col gap-3 sm:mb-8 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-2">
          <Skeleton className="h-8 w-40" />
          <Skeleton className="h-4 w-[30rem] max-w-[85vw]" />
        </div>
        <Skeleton className="h-10 w-full sm:w-72" />
      </div>
      <div className="mb-4 grid gap-4 lg:grid-cols-3">
        <SplitCardSkeleton />
        <SplitCardSkeleton />
        <SplitCardSkeleton />
      </div>
      <div className="space-y-4">
        <TableBlockSkeleton titleWidth="w-44" />
        <TableBlockSkeleton titleWidth="w-56" />
      </div>
    </div>
  );
}
