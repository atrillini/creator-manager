import Link from "next/link";
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

type Props = {
  href: string;
  title: string;
  icon: LucideIcon;
  value: string;
  subtitle?: string;
  className?: string;
  children?: ReactNode;
};

export function DashboardStatLink({
  href,
  title,
  icon: Icon,
  value,
  subtitle,
  className,
  children,
}: Props) {
  return (
    <Link
      href={href}
      className={cn(
        "group block rounded-2xl border border-gray-100 bg-white p-4 shadow-[0_2px_12px_rgba(0,0,0,0.04)] transition hover:border-gray-200 hover:shadow-md",
        className
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs font-medium text-gray-500">{title}</p>
          <p className="mt-1 text-2xl font-bold tabular-nums text-gray-900">{value}</p>
          {subtitle ? (
            <p className="mt-0.5 text-xs text-gray-500 group-hover:text-gray-600">
              {subtitle}
            </p>
          ) : null}
        </div>
        <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
          <Icon className="size-4" />
        </div>
      </div>
      {children ? <div className="mt-3 border-t border-gray-100 pt-3">{children}</div> : null}
    </Link>
  );
}
