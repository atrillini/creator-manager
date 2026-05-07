import { Skeleton } from "@/components/ui/skeleton";

function StatCardSkeleton() {
  return (
    <section className="rounded-3xl bg-white p-6 shadow-[0_8px_30px_rgba(0,0,0,0.04)]">
      <div className="mb-3 flex items-center justify-between">
        <Skeleton className="h-4 w-36 rounded-md" />
        <Skeleton className="h-4 w-4 rounded-full" />
      </div>
      <Skeleton className="h-8 w-20 rounded-lg" />
      <Skeleton className="mt-2 h-3 w-28 rounded-md" />
    </section>
  );
}

export default function DashboardPageLoading() {
  return (
    <div>
      <div className="mb-6 space-y-2 sm:mb-8">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-96 max-w-[85vw]" />
      </div>
      <section className="mb-4 rounded-3xl bg-white p-5 shadow-[0_8px_30px_rgba(0,0,0,0.04)]">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div className="space-y-2">
            <Skeleton className="h-5 w-40 rounded-md" />
            <Skeleton className="h-3 w-56 rounded-md" />
          </div>
          <Skeleton className="h-9 w-28 rounded-xl" />
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <Skeleton className="h-16 w-full rounded-2xl" />
          <Skeleton className="h-16 w-full rounded-2xl" />
          <Skeleton className="h-16 w-full rounded-2xl" />
        </div>
      </section>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCardSkeleton />
        <StatCardSkeleton />
        <div className="sm:col-span-2 lg:col-span-1">
          <StatCardSkeleton />
        </div>
      </div>
    </div>
  );
}
