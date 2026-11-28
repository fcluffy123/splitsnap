// lib/scan.ts
// Shared types + validation for the receipt scan result.
// Used by both the browser (display) and /api/scan (server-side validation),
// so this file must stay free of DOM/browser APIs.

export type ScannedItem = { name: string; price: number; qty: number };

export type ScannedReceipt = {
  items: ScannedItem[];
  subtotal: number;
  discount: number; // total discount, a POSITIVE number (0 when none)
  tax: number;
  service: number;
  total: number;
  currency: string;
  taxIncluded?: boolean; // "Total (+VAT)" receipts: tax is inside the prices
  totalDiscount?: number; // Gemini-reported sum of all promo/discount amounts
};

const isNum = (v: unknown): v is number =>
  typeof v === "number" && Number.isFinite(v);

// A net amount of 0 or less on a line whose name looks like a promo is not a
// real product — it's Gemini leaking a promo line through. Drop it.
const PROMO_NAME = /(tang|tiet\s*kiem|free|discount|giam)/i;

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
  let discount = 0; // standalone discount lines only — per-item promos are
  // already baked into each item's net total, so adding them here again
  // would double-count.

  for (const raw of d.items) {
    if (typeof raw !== "object" || raw === null) return null;
    const it = raw as Record<string, unknown>;
    if (typeof it.name !== "string" || !it.name.trim()) return null;
    const name = it.name.trim();
    const qty = isNum(it.qty) ? Math.max(1, Math.floor(it.qty)) : 1;

    // Old (legacy) shape: a single `price` per item, discount lines negative.
    if (!isNum(it.netTotal) && !isNum(it.lineTotal)) {
      if (!isNum(it.price)) continue;
      if (it.price < 0) {
        discount += Math.abs(it.price);
        continue;
      }
      items.push({ name, price: it.price, qty });
      continue;
    }

    // New shape: lineTotal, discount and netTotal per item.
    const lineTotal = isNum(it.lineTotal) ? it.lineTotal : 0;
    const rawDiscount = it.discount;
    const itemDiscount =
      isNum(rawDiscount) && rawDiscount >= 0
        ? rawDiscount
        : Math.max(0, -Number(rawDiscount ?? 0)); // tolerate negatives, make positive
    const net = isNum(it.netTotal)
      ? it.netTotal
      : lineTotal - itemDiscount;

    if (net <= 0) {
      if (PROMO_NAME.test(name)) continue; // leaked promo line — drop it
      if (net < 0) discount += Math.abs(net); // real refund-looking line
      continue;
    }
    // Unit price for the app = net total / qty (2 decimals for USD/EUR-safe).
    items.push({ name, price: Math.round((net / qty) * 100) / 100, qty });
  }

  const num = (v: unknown) => (isNum(v) && v >= 0 ? v : 0);
  return {
    items,
    subtotal: num(d.subtotal),
    discount: Math.max(discount, num(d.discount)),
    tax: num(d.tax),
    service: num(d.service),
    total: num(d.total),
    currency: typeof d.currency === "string" && d.currency ? d.currency : "VND",
    taxIncluded: d.taxIncluded === true,
    totalDiscount: num(d.totalDiscount),
  };
}
