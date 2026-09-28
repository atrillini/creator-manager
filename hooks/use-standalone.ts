import { useSyncExternalStore } from "react";

const QUERY = "(display-mode: standalone)";

function subscribe(onChange: () => void) {
  const mq = window.matchMedia(QUERY);
  mq.addEventListener("change", onChange);
  return () => mq.removeEventListener("change", onChange);
}

function getSnapshot() {
  return window.matchMedia(QUERY).matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
}

/** true quando il CRM gira come app installata (Aggiungi a Home), non in una scheda del browser. */
export function useStandalone() {
  return useSyncExternalStore(subscribe, getSnapshot, () => false);
}
