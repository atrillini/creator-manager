import { getDeliverableCalendarItems } from "@/lib/data/calendar-deliverables";
import { DashboardHeader } from "@/components/dashboard-header";
import { DeliverableMonthCalendar } from "./deliverable-month-calendar";

export default async function CollaborationCalendarScreen() {
  const items = await getDeliverableCalendarItems();

  return (
    <div className="min-h-0 space-y-5 sm:space-y-6 sm:rounded-3xl sm:bg-[#F5F5F7] sm:p-5">
      <DashboardHeader
        title="Calendario"
        className="mb-4 sm:mb-5"
        description="I contenuti in programma, dalla tabella scadenze collegata a brand e collaborazioni."
      />
      <DeliverableMonthCalendar items={items} />
    </div>
  );
}
