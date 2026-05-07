import { Skeleton } from "@/components/ui/skeleton";

export default function CalendarLoading() {
  return (
    <div>
      <div className="mb-6 space-y-2 sm:mb-8">
        <Skeleton className="h-8 w-44" />
        <Skeleton className="h-4 w-72 max-w-[80vw]" />
      </div>
      <section className="rounded-3xl bg-white p-4 shadow-[0_8px_30px_rgba(0,0,0,0.04)]">
        <div className="mb-4 flex items-center justify-between">
          <Skeleton className="h-9 w-32 rounded-xl" />
          <Skeleton className="h-9 w-56 rounded-xl" />
          <Skeleton className="h-9 w-32 rounded-xl" />
        </div>
        <div className="grid grid-cols-7 gap-2">
          {Array.from({ length: 35 }).map((_, idx) => (
            <Skeleton key={idx} className="h-24 w-full rounded-xl" />
          ))}
        </div>
      </section>
    </div>
  );
}
