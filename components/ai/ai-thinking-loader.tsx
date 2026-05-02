"use client";

import { cn } from "@/lib/utils";

type Props = {
  label?: string;
  className?: string;
};

export function AIThinkingLoader({
  label = "L'IA sta elaborando...",
  className,
}: Props) {
  return (
    <div className={cn("flex items-center gap-2 text-xs text-gray-500", className)}>
      <div className="flex items-center gap-1">
        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-gray-400 [animation-delay:-0.25s]" />
        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-gray-400 [animation-delay:-0.12s]" />
        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-gray-400" />
      </div>
      <span>{label}</span>
    </div>
  );
}
