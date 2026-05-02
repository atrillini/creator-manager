"use client";

import {
  Banknote,
  Building2,
  ChevronLeft,
  Inbox,
  LayoutDashboard,
  ListTodo,
  Menu,
  Calendar,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { useEffect, useState } from "react";

const items = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/collaborazioni", label: "Collaborazioni", icon: ListTodo },
  { href: "/inbox", label: "Inbox", icon: Inbox },
  { href: "/calendario", label: "Calendario", icon: Calendar },
  { href: "/aziende", label: "Aziende", icon: Building2 },
  { href: "/finanze", label: "Finanze", icon: Banknote },
];

export function AppSidebar() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [canAccessInboxItem, setCanAccessInboxItem] = useState(false);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/inbox/access", { cache: "no-store" });
        const data = (await res.json()) as { ok?: boolean; canAccess?: boolean };
        if (!cancelled) {
          setCanAccessInboxItem(Boolean(res.ok && data.canAccess));
        }
      } catch {
        if (!cancelled) setCanAccessInboxItem(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const visibleItems = items.filter((item) => (item.href === "/inbox" ? canAccessInboxItem : true));

  return (
    <>
      <Button
        type="button"
        size="icon"
        variant="outline"
        className="fixed left-4 top-4 z-50 border border-gray-200/90 bg-white/90 shadow-[0_2px_12px_rgba(0,0,0,0.08)] backdrop-blur"
        aria-label="Apri menu"
        onClick={() => setOpen((v) => !v)}
      >
        {open ? <ChevronLeft className="size-4" /> : <Menu className="size-4" />}
      </Button>

      {open ? (
        <button
          type="button"
          aria-label="Chiudi menu"
          className="fixed inset-0 z-40 bg-black/15 backdrop-blur-[1px]"
          onClick={() => setOpen(false)}
        />
      ) : null}

      <aside
        className={cn(
          "ui-ease fixed inset-y-0 left-0 z-50 flex h-svh w-72 shrink-0 flex-col border-r border-white/50 bg-gradient-to-b from-white/80 via-white/65 to-white/55 text-gray-800 shadow-[0_0_0_1px_rgba(255,255,255,0.5)_inset] backdrop-blur-2xl backdrop-saturate-150 transition-transform duration-300",
          open ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="flex h-14 items-center gap-2 border-b border-white/20 px-4">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-blue-500/12 text-sm font-bold text-blue-600">
            CC
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold tracking-tight text-gray-900">
              CreatorCRM
            </p>
            <p className="text-xs text-gray-500">Content Creator</p>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="ml-auto h-8 w-8 text-gray-500"
            onClick={() => setOpen(false)}
            aria-label="Chiudi sidebar"
          >
            <ChevronLeft className="size-4" />
          </Button>
        </div>
        <ScrollArea className="flex-1">
          <nav className="flex flex-col gap-0.5 p-3" aria-label="Sezioni app">
            {visibleItems.map((item) => {
              const isCollabItem = item.href === "/collaborazioni";
              const active = isCollabItem
                ? pathname === "/collaborazioni" ||
                  pathname?.startsWith("/collaborations/")
                : item.href === "/"
                  ? pathname === "/"
                  : pathname === item.href ||
                    pathname?.startsWith(`${item.href}/`);
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm font-medium text-gray-600 transition-colors",
                    active
                      ? "bg-white/80 text-gray-900 shadow-sm ring-1 ring-gray-200/50"
                      : "hover:bg-white/50 hover:text-gray-900"
                  )}
                >
                  <Icon className="size-4 shrink-0" />
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </ScrollArea>
        <Separator className="bg-gray-200/50" />
        <div className="p-3 text-xs text-gray-400">Next.js · shadcn · Supabase</div>
      </aside>
    </>
  );
}
