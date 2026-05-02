import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { AIAssistantDrawer } from "@/components/ai/ai-assistant-drawer";
import { UserMenu } from "@/components/auth/user-menu";

type Props = {
  title: string;
  description?: string;
  /** Barra a destra (es. selettore stato) */
  end?: ReactNode;
  className?: string;
  titleClassName?: string;
  descriptionClassName?: string;
  /** @deprecated usare `end` */
  actions?: ReactNode;
};

export function DashboardHeader({
  title,
  description,
  end,
  className,
  titleClassName,
  descriptionClassName,
  actions,
}: Props) {
  const right = end ?? actions;
  return (
    <div
      className={cn(
        "mb-6 flex flex-col gap-3 sm:mb-8 sm:flex-row sm:items-start sm:justify-between",
        className
      )}
    >
      <div>
        <h1
          className={cn(
            "text-2xl font-semibold tracking-tight text-gray-900",
            titleClassName
          )}
        >
          {title}
        </h1>
        {description && (
          <p
            className={cn(
              "mt-1 max-w-2xl text-sm text-gray-500",
              descriptionClassName
            )}
          >
            {description}
          </p>
        )}
      </div>
      <div className="flex w-full min-w-0 items-start justify-end gap-2 sm:max-w-[30rem] sm:shrink-0">
        {right ? <div className="w-full min-w-0">{right}</div> : null}
        <AIAssistantDrawer />
        <UserMenu />
      </div>
    </div>
  );
}
