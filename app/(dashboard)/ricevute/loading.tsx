import { Skeleton } from "@/components/ui/skeleton";

export default function RicevuteLoading() {
  return (
    <div>
      <div className="mb-6 flex flex-col gap-3 sm:mb-8 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-2">
          <Skeleton className="h-8 w-40" />
          <Skeleton className="h-4 w-[30rem] max-w-[85vw]" />
        </div>
        <Skeleton className="h-9 w-full sm:w-96" />
      </div>
      <div className="mb-4 flex gap-1.5">
        <Skeleton className="h-7 w-16 rounded-full" />
        <Skeleton className="h-7 w-16 rounded-full" />
      </div>
      <div className="mb-4 grid gap-4 md:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <section key={i} className="rounded-3xl bg-white p-5 shadow-[0_8px_30px_rgba(0,0,0,0.04)]">
            <Skeleton className="h-3 w-36 rounded-md" />
            <Skeleton className="mt-2 h-9 w-32 rounded-lg" />
            <Skeleton className="mt-3 h-3 w-full rounded-full" />
          </section>
        ))}
      </div>
      <section className="space-y-2 rounded-3xl bg-white p-4 shadow-[0_8px_30px_rgba(0,0,0,0.04)]">
        {[0, 1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-10 w-full rounded-xl" />
        ))}
      </section>
    </div>
  );
}
