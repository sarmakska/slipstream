export function formatNum(n: number | null | undefined): string {
  return n == null ? "0" : Number(n).toLocaleString("en-GB");
}

export function formatShort(n: number | null | undefined): string {
  if (n == null) return "0";
  if (n >= 1e6) return (n / 1e6).toFixed(1) + "M";
  if (n >= 1e3) return Math.round(n / 1e3) + "k";
  return String(n);
}

export function shortId(s: string | null | undefined): string {
  return (s ?? "").slice(0, 8);
}

export function timeOf(ts: string | null | undefined): string {
  if (!ts) return "";
  const d = new Date(ts);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleString();
}
