import { DashboardHeader } from "@/components/dashboard-header";
import { YouTubeHeroWidget } from "@/components/dashboard/youtube-hero-widget";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getDashboardStats, getLatestYoutubeStats } from "@/lib/data/fetchers";
import { Calendar, Euro, ListTodo } from "lucide-react";

export default async function DashboardPage() {
  const [stats, yt] = await Promise.all([getDashboardStats(), getLatestYoutubeStats()]);

  return (
    <div>
      <DashboardHeader
        title="Dashboard"
        description="Riepilogo collaborazioni, scadenze e andamento economico. Dati fittizi per l’anteprima."
      />
      <div className="ui-enter mb-4">
        <YouTubeHeroWidget initial={yt} />
      </div>
      <div className="ui-stagger grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-gray-900">Collaborazioni aperte</CardTitle>
            <ListTodo className="size-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold tabular-nums text-gray-900">
              {stats.openCollaborations}
            </p>
            <p className="text-xs text-gray-500">Board non completate</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-gray-900">Mese in corso</CardTitle>
            <Euro className="size-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold tabular-nums text-gray-900">
              {stats.thisMonthEarnings}
            </p>
            <p className="text-xs text-gray-500">Ricavi stimati</p>
          </CardContent>
        </Card>
        <Card className="sm:col-span-2 lg:col-span-1">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-gray-900">Prossima scadenza</CardTitle>
            <Calendar className="size-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <p className="text-lg font-semibold text-gray-900">
              {stats.nextDeadline.label}
            </p>
            <p className="text-sm text-gray-500">{stats.nextDeadline.when}</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
