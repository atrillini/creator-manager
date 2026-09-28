"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

type InboxAccess = { canAccess: boolean; pending: number };

/** Accesso all'inbox e badge "da gestire", aggiornato a ogni cambio pagina. */
export function useInboxAccess(): InboxAccess {
  const pathname = usePathname();
  const [state, setState] = useState<InboxAccess>({ canAccess: false, pending: 0 });
  useEffect(() => {
    let cancelled = false;
    fetch("/api/inbox/access", { cache: "no-store" })
      .then((res) => res.json() as Promise<{ ok?: boolean; canAccess?: boolean; pending?: number }>)
      .then((data) => {
        if (!cancelled) setState({ canAccess: Boolean(data.ok && data.canAccess), pending: data.pending ?? 0 });
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [pathname]);
  return state;
}
