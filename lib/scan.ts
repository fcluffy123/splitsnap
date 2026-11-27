// lib/scan.ts
// Shared types + validation for the receipt scan result.
// Used by both the browser (display) and /api/scan (server-side validation),
// so this file must stay free of DOM/browser APIs.

export type ScannedItem = { name: string; price: number; qty: number };

export type ScannedReceipt = {
  items: ScannedItem[];
  subtotal: number;
  tax: number;
  service: number;
  total: number;
  currency: string;
};

const isNum = (v: unknown): v is number =>
  typeof v === "number" && Number.isFinite(v);

/**
 * Check that Gemini's answer matches the shape we asked for.
 * Returns a cleaned-up ScannedReceipt, or null if anything is off.
 * Tolerant where sensible (qty defaults to 1, missing numbers become 0),
 * strict about the overall structure so garbage never reaches the UI.
 */
export function validateScannedReceipt(data: unknown): ScannedReceipt | null {
  if (typeof data !== "object" || data === null) return null;
  const d = data as Record<string, unknown>;
  if (!Array.isArray(d.items)) return null;

  const items: ScannedItem[] = [];
  for (const raw of d.items) {
    if (typeof raw !== "object" || raw === null) return null;
    const it = raw as Record<string, unknown>;
    if (typeof it.name !== "string" || !it.name.trim()) return null;
    if (!isNum(it.price) || it.price < 0) return null;
    const qty = isNum(it.qty) ? Math.max(1, Math.floor(it.qty)) : 1;
    items.push({ name: it.name.trim(), price: it.price, qty });
  }

  const num = (v: unknown) => (isNum(v) && v >= 0 ? v : 0);
  return {
    items,
    subtotal: num(d.subtotal),
    tax: num(d.tax),
    service: num(d.service),
    total: num(d.total),
    currency: typeof d.currency === "string" && d.currency ? d.currency : "VND",
  };
}
