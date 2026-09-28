"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  Banknote,
  Building2,
  Calendar,
  Inbox,
  LayoutDashboard,
  ListTodo,
  MoreHorizontal,
  ReceiptText,
  X,
  type LucideIcon,
} from "lucide-react";
import { useInboxAccess } from "@/hooks/use-inbox-access";
import { cn } from "@/lib/utils";

type Item = { href: string; label: string; icon: LucideIcon; match?: (p: string) => boolean };

const MAIN: Item[] = [
  { href: "/dashboard", label: "Home", icon: LayoutDashboard },
  {
    href: "/collaborazioni",
    label: "Collab",
    icon: ListTodo,
    match: (p) => p.startsWith("/collaborazioni") || p.startsWith("/collaborations/"),
  },
  { href: "/inbox", label: "Inbox", icon: Inbox },
  { href: "/calendario", label: "Calendario", icon: Calendar },
];

const MORE: Item[] = [
  { href: "/aziende", label: "Aziende", icon: Building2 },
  { href: "/finanze", label: "Finanze", icon: Banknote },
  { href: "/ricevute", label: "Ricevute", icon: ReceiptText },
];

const isActive = (item: Item, pathname: string) =>
  item.match ? item.match(pathname) : pathname === item.href || pathname.startsWith(`${item.href}/`);

/** Navigazione stile app nativa sotto la soglia desktop (lg). */
export function MobileTabBar() {
  const pathname = usePathname() ?? "";
  const { canAccess, pending } = useInboxAccess();
  const [moreOpen, setMoreOpen] = useState(false);
  const [prevPathname, setPrevPathname] = useState(pathname);
  if (prevPathname !== pathname) {
    setPrevPathname(pathname);
    setMoreOpen(false);
  }

  const items = MAIN.filter((i) => i.href !== "/inbox" || canAccess);
  const moreActive = MORE.some((i) => isActive(i, pathname));

  return (
    <>
      {moreOpen ? (
        <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-label="Altre sezioni">
          <button
            type="button"
            aria-label="Chiudi"
            className="absolute inset-0 bg-black/20 backdrop-blur-[1px]"
            onClick={() => setMoreOpen(false)}
          />
          <div className="absolute inset-x-3 bottom-[calc(env(safe-area-inset-bottom)+4.75rem)] rounded-3xl bg-white p-2 shadow-[0_12px_40px_rgba(0,0,0,0.15)]">
            <div className="flex items-center justify-between px-3 py-2">
              <p className="text-sm font-semibold text-gray-900">Altro</p>
              <button
                type="button"
                onClick={() => setMoreOpen(false)}
                className="flex size-9 items-center justify-center rounded-full text-gray-500 hover:bg-gray-100"
                aria-label="Chiudi"
              >
                <X className="size-4" />
              </button>
            </div>
            {MORE.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex min-h-12 items-center gap-3 rounded-2xl px-3 text-[15px] font-medium",
                    isActive(item, pathname) ? "bg-gray-100 text-gray-900" : "text-gray-700 active:bg-gray-50"
                  )}
                >
                  <Icon className="size-5 text-gray-500" />
                  {item.label}
                </Link>
              );
            })}
          </div>
        </div>
      ) : null}

      <nav
        aria-label="Navigazione principale"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-gray-200/70 bg-white/85 pb-safe backdrop-blur-xl backdrop-saturate-150 lg:hidden"
      >
        <ul className="mx-auto flex max-w-lg items-stretch justify-around px-1">
          {items.map((item) => {
            const Icon = item.icon;
            const active = isActive(item, pathname);
            const badge = item.href === "/inbox" && pending > 0 ? pending : 0;
            return (
              <li key={item.href} className="flex-1">
                <Link
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex h-14 flex-col items-center justify-center gap-0.5 text-[10px] font-medium",
                    active ? "text-blue-600" : "text-gray-500"
                  )}
                >
                  <span className="relative">
                    <Icon className="size-[22px]" strokeWidth={active ? 2.2 : 1.8} />
                    {badge ? (
                      <span className="absolute -right-2.5 -top-1.5 min-w-[18px] rounded-full bg-red-500 px-1 text-center text-[10px] font-semibold leading-[18px] text-white">
                        {badge > 99 ? "99+" : badge}
                      </span>
                    ) : null}
                  </span>
                  {item.label}
                </Link>
              </li>
            );
          })}
          <li className="flex-1">
            <button
              type="button"
              onClick={() => setMoreOpen((o) => !o)}
              aria-expanded={moreOpen}
              className={cn(
                "flex h-14 w-full flex-col items-center justify-center gap-0.5 text-[10px] font-medium",
                moreActive || moreOpen ? "text-blue-600" : "text-gray-500"
              )}
            >
              <MoreHorizontal className="size-[22px]" />
              Altro
            </button>
          </li>
        </ul>
      </nav>
    </>
  );
}
