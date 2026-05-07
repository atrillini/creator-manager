import { Skeleton } from "@/components/ui/skeleton";

function KanbanColumnSkeleton() {
  return (
    <div className="flex min-h-[320px] flex-col overflow-hidden rounded-3xl border-0 bg-white p-3 shadow-[0_8px_30px_rgba(0,0,0,0.04)]">
      <div className="mb-2 flex items-center justify-between">
        <Skeleton className="h-4 w-24 rounded-md" />
        <Skeleton className="h-5 w-8 rounded-full" />
      </div>
      <div className="space-y-2">
        <Skeleton className="h-16 w-full rounded-xl" />
        <Skeleton className="h-16 w-full rounded-xl" />
        <Skeleton className="h-16 w-full rounded-xl" />
      </div>
    </div>
  );
}

export default function CollaborazioniLoading() {
  return (
    <div className="flex min-h-0 flex-col">
      <div className="mb-6 flex flex-col gap-3 sm:mb-8 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-2">
          <Skeleton className="h-8 w-56" />
          <Skeleton className="h-4 w-[34rem] max-w-[85vw]" />
        </div>
        <Skeleton className="h-10 w-full sm:w-64" />
      </div>
      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
        <KanbanColumnSkeleton />
        <KanbanColumnSkeleton />
        <KanbanColumnSkeleton />
        <KanbanColumnSkeleton />
      </div>
    </div>
  );
}
