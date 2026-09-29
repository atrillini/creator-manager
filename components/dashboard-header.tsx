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

/**
 * Telefono: titolo + icone (AI, utente) sulla prima riga, azioni a tutta larghezza sotto.
 * Da sm in su: titolo | azioni (max 30rem) | icone, su una riga.
 */
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
        "mb-6 grid grid-cols-[minmax(0,1fr)_auto] items-start gap-x-3 gap-y-3 sm:mb-8 sm:grid-cols-[minmax(0,1fr)_auto_auto]",
        className
      )}
    >
      <div className="col-start-1 row-start-1 min-w-0">
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
      {right ? (
        <div className="col-span-2 row-start-2 min-w-0 sm:col-span-1 sm:col-start-2 sm:row-start-1 sm:w-[min(30rem,50vw)]">
          {right}
        </div>
      ) : null}
      <div className="col-start-2 row-start-1 flex items-start gap-2 sm:col-start-3">
        <AIAssistantDrawer />
        <UserMenu />
      </div>
    </div>
  );
}
