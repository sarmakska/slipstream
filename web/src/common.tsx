// Small shared UI primitives used across the dashboard views.
import { useEffect, useState } from "react";

export function useFetch<T>(fn: () => Promise<T>, deps: unknown[]): T | null {
  const [data, setData] = useState<T | null>(null);
  useEffect(() => {
    let live = true;
    fn().then((d) => { if (live) setData(d); }).catch(() => { if (live) setData(null); });
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return data;
}

export function Empty({ children }: { children: string }) {
  return <div className="empty">{children}</div>;
}

/** Short relative time like "now", "3m", "2h" from an ISO timestamp. */
export function ago(ts: string): string {
  if (!ts) return "";
  const s = Math.max(0, Math.round((Date.now() - new Date(ts).getTime()) / 1000));
  if (s < 45) return "now";
  if (s < 3600) return `${Math.round(s / 60)}m`;
  if (s < 86400) return `${Math.round(s / 3600)}h`;
  return `${Math.round(s / 86400)}d`;
}
