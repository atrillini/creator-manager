import { AppSidebar } from "@/components/app-sidebar";
import { GoogleRenewBanner } from "@/components/google-renew-banner";
import { MobileTabBar } from "@/components/mobile-tab-bar";

export default function DashboardGroupLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-svh w-full max-w-full text-gray-900">
      <AppSidebar />
      <main className="ui-enter mx-auto max-w-7xl px-4 pt-[calc(env(safe-area-inset-top)+1rem)] pb-[calc(env(safe-area-inset-bottom)+6rem)] sm:px-6 lg:px-10 lg:pt-20 lg:pb-8">
        <GoogleRenewBanner />
        {children}
      </main>
      <MobileTabBar />
    </div>
  );
}
