import type { Lang } from "./types";

export function formatMoney(n: number, currency = "XOF", lang: Lang = "FR"): string {
  const abs = Math.abs(n);
  const formatted = new Intl.NumberFormat(lang === "FR" ? "fr-FR" : "en-US", {
    maximumFractionDigits: 0,
    minimumFractionDigits: 0,
  }).format(Math.round(abs));
  const sign = n < 0 ? "−" : "";
  return `${sign}${formatted} ${currency}`;
}

export function formatNumber(n: number, lang: Lang = "FR"): string {
  return new Intl.NumberFormat(lang === "FR" ? "fr-FR" : "en-US", {
    maximumFractionDigits: 0,
  }).format(Math.round(n));
}

export function formatDate(iso: string, lang: Lang = "FR"): string {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return iso;
  const date = new Date(Date.UTC(y, m - 1, d));
  return new Intl.DateTimeFormat(lang === "FR" ? "fr-FR" : "en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

export function formatPct(rate: number): string {
  return `${(rate * 100).toLocaleString("fr-FR", { maximumFractionDigits: 2 })} %`;
}

export function daysUntil(iso: string): number {
  const [y, m, d] = iso.split("-").map(Number);
  const target = Date.UTC(y, m - 1, d);
  const now = new Date();
  const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((target - today) / 86_400_000);
}

export function addDays(iso: string, days: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  return dt.toISOString().slice(0, 10);
}

export function parseAmount(raw: string): number {
  const cleaned = raw.replace(/\s/g, "").replace(",", ".");
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : 0;
}
