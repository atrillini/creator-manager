import * as React from "react";
import { cn } from "@/lib/utils";

const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.ComponentProps<"textarea">
>(({ className, ...props }, ref) => {
  return (
    <textarea
      className={cn(
        "placeholder:text-gray-400 flex min-h-[100px] w-full rounded-xl border-0 bg-gray-100/50 px-3 py-2 text-sm text-gray-800 shadow-none transition-[color,box-shadow] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/20 focus-visible:ring-offset-0 disabled:cursor-not-allowed disabled:opacity-50",
        "resize-y",
        className
      )}
      ref={ref}
      {...props}
    />
  );
});
Textarea.displayName = "Textarea";

export { Textarea };
