import { Skeleton } from "@/components/ui/skeleton";

function HeaderSkeleton() {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:mb-8 sm:flex-row sm:items-start sm:justify-between">
      <div className="space-y-2">
        <Skeleton className="h-8 w-48 rounded-lg" />
        <Skeleton className="h-4 w-80 max-w-[80vw] rounded-md" />
      </div>
      <div className="flex w-full justify-end gap-2 sm:max-w-[30rem]">
        <Skeleton className="h-10 w-full max-w-[14rem] rounded-xl" />
        <Skeleton className="h-10 w-10 rounded-full" />
        <Skeleton className="h-10 w-10 rounded-full" />
      </div>
    </div>
  );
}

function MetricCardSkeleton() {
  return (
    <section className="rounded-3xl bg-white p-5 shadow-[0_8px_30px_rgba(0,0,0,0.04)]">
      <Skeleton className="h-3 w-32 rounded-md" />
      <Skeleton className="mt-3 h-9 w-24 rounded-lg" />
      <div className="mt-4 flex flex-wrap gap-2">
        <Skeleton className="h-6 w-20 rounded-full" />
        <Skeleton className="h-6 w-24 rounded-full" />
        <Skeleton className="h-6 w-16 rounded-full" />
      </div>
    </section>
  );
}

function TableSkeleton() {
  return (
    <section className="overflow-hidden rounded-3xl bg-white p-4 shadow-[0_8px_30px_rgba(0,0,0,0.04)]">
      <Skeleton className="mb-4 h-5 w-48 rounded-md" />
      <div className="space-y-3">
        <Skeleton className="h-10 w-full rounded-xl" />
        <Skeleton className="h-10 w-full rounded-xl" />
        <Skeleton className="h-10 w-full rounded-xl" />
        <Skeleton className="h-10 w-full rounded-xl" />
      </div>
    </section>
  );
}

export default function DashboardLoading() {
  return (
    <div>
      <HeaderSkeleton />
      <div className="ui-stagger mb-4 grid gap-4 lg:grid-cols-3">
        <MetricCardSkeleton />
        <MetricCardSkeleton />
        <MetricCardSkeleton />
      </div>
      <div className="space-y-4">
        <TableSkeleton />
        <TableSkeleton />
      </div>
    </div>
  );
}
