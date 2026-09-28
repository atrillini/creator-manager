"use client";

import type { ReactNode } from "react";
import { useStandalone } from "@/hooks/use-standalone";

const CONNECT_HREF = "/api/google/connect?next=/dashboard";

/**
 * Link al consenso Google. Nell'app installata su iOS il giro OAuth si perde
 * (il ritorno da Google si apre in Safari): lì lo apriamo direttamente in Safari.
 */
export function GoogleConnectLink({ className, children }: { className?: string; children: ReactNode }) {
  const standalone = useStandalone();
  if (!standalone) {
    return (
      <a href={CONNECT_HREF} className={className}>
        {children}
      </a>
    );
  }
  return (
    <span className="inline-flex flex-col items-start gap-1">
      <a href={CONNECT_HREF} target="_blank" rel="noopener" className={className}>
        {children}
      </a>
      <span className="text-[11px] font-normal text-gray-500">
        Si apre in Safari: se richiesto accedi al CRM anche lì, poi torna nell&apos;app.
      </span>
    </span>
  );
}
