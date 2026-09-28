import { useEffect, useState } from "react";

/** Secondi trascorsi mentre `active` è vero (per i loader delle operazioni lunghe). */
export function useElapsedSeconds(active: boolean) {
  const [elapsedMs, setElapsedMs] = useState(0);
  useEffect(() => {
    if (!active) return;
    const startedAt = Date.now();
    const id = setInterval(() => setElapsedMs(Date.now() - startedAt), 250);
    return () => {
      clearInterval(id);
      setElapsedMs(0);
    };
  }, [active]);
  return Math.floor(elapsedMs / 1000);
}
