import { AppSidebar } from "@/components/app-sidebar";

export default function DashboardGroupLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-svh w-full max-w-full text-gray-900">
      <AppSidebar />
      <div className="min-w-0 flex-1">
        <main className="mx-auto max-w-7xl p-4 sm:p-6 lg:px-10 lg:py-8">{children}</main>
      </div>
    </div>
  );
}
