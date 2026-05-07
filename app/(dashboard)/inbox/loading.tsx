import { Skeleton } from "@/components/ui/skeleton";

function InboxRowSkeleton() {
  return (
    <div className="rounded-2xl border border-gray-100 bg-white px-3 py-2.5">
      <div className="grid grid-cols-[1.1fr_1.4fr_1fr_auto] items-center gap-3">
        <div className="space-y-1.5">
          <Skeleton className="h-4 w-32 rounded-md" />
          <Skeleton className="h-3 w-24 rounded-md" />
        </div>
        <div className="space-y-1.5">
          <Skeleton className="h-4 w-52 rounded-md" />
          <Skeleton className="h-3 w-64 rounded-md" />
        </div>
        <div className="flex gap-1">
          <Skeleton className="h-6 w-14 rounded-full" />
          <Skeleton className="h-6 w-16 rounded-full" />
        </div>
        <div className="flex justify-end gap-2">
          <Skeleton className="h-8 w-16 rounded-lg" />
          <Skeleton className="h-8 w-24 rounded-lg" />
        </div>
      </div>
    </div>
  );
}

export default function InboxLoading() {
  return (
    <div className="min-h-0 bg-[#F5F5F7]">
      <div className="mb-4 rounded-3xl bg-white p-4 shadow-[0_10px_35px_rgba(15,23,42,0.06)] sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-2">
            <Skeleton className="h-8 w-64 rounded-lg" />
            <Skeleton className="h-4 w-[36rem] max-w-[80vw] rounded-md" />
          </div>
          <div className="flex items-center gap-2">
            <Skeleton className="h-9 w-56 rounded-xl" />
            <Skeleton className="h-9 w-28 rounded-xl" />
            <Skeleton className="h-9 w-32 rounded-xl" />
          </div>
        </div>
        <div className="mt-3 flex gap-1.5">
          <Skeleton className="h-8 w-16 rounded-lg" />
          <Skeleton className="h-8 w-20 rounded-lg" />
          <Skeleton className="h-8 w-24 rounded-lg" />
        </div>
      </div>

      <section className="rounded-3xl bg-white p-2 shadow-[0_10px_35px_rgba(15,23,42,0.06)] sm:p-3">
        <div className="grid grid-cols-[1.1fr_1.4fr_1fr_auto] gap-3 px-3 py-2">
          <Skeleton className="h-3 w-20 rounded-md" />
          <Skeleton className="h-3 w-20 rounded-md" />
          <Skeleton className="h-3 w-10 rounded-md" />
          <Skeleton className="ml-auto h-3 w-12 rounded-md" />
        </div>
        <div className="space-y-1">
          <InboxRowSkeleton />
          <InboxRowSkeleton />
          <InboxRowSkeleton />
          <InboxRowSkeleton />
          <InboxRowSkeleton />
        </div>
        <div className="pt-3 text-center">
          <Skeleton className="mx-auto h-9 w-28 rounded-lg" />
        </div>
      </section>
      <div className="mt-4 grid min-h-[32vh] gap-4 md:grid-cols-[390px_1fr]">
        <Skeleton className="h-full rounded-3xl" />
        <Skeleton className="h-full rounded-3xl" />
      </div>
    </div>
  );
}
