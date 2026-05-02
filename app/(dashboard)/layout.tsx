import { AppSidebar } from "@/components/app-sidebar";

export default function DashboardGroupLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-svh w-full max-w-full text-gray-900">
      <AppSidebar />
      <main className="ui-enter mx-auto max-w-7xl p-4 pt-16 sm:p-6 sm:pt-20 lg:px-10 lg:py-8 lg:pt-20">
        {children}
      </main>
    </div>
  );
}
