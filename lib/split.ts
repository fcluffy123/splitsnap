// lib/split.ts
// All money math for SplitSnap lives here, so the UI stays dumb and the
// numbers can be unit-tested without rendering anything.
//
// Money is handled in integer "minor units" (e.g. đồng, cents) to avoid
// floating-point rounding drift. We keep numbers as plain JS numbers and
// round at well-defined points only.

export type Currency = "VND" | "USD" | "EUR";

export const CURRENCIES: Currency[] = ["VND", "USD", "EUR"];

// Smallest unit the currency uses: VND has no decimals (1đ), USD/EUR use cents.
export function smallestUnit(currency: Currency): number {
  return currency === "VND" ? 1 : 0.01;
}

export type Person = {
  id: string;
  name: string;
  color: string; // chip color, assigned automatically
};

export type Item = {
  id: string;
  name: string;
  price: number; // unit price in major currency units (e.g. 125000 for 125.000đ)
  qty: number;
  assignedTo: string[]; // person ids; empty = unassigned (warned about)
};

export type Extras = {
  taxPercent: number; // e.g. 10 means 10%
  servicePercent: number;
  // Tip is either a percentage of the items subtotal, or a fixed amount.
  tipPercent: number;
  tipFixed: number;
  // Discount taken off the items subtotal BEFORE tax/service/tip:
  // "fixed" = discountValue is an amount, "percent" = discountValue is a %.
  discountType: "fixed" | "percent";
  discountValue: number;
  // Receipt prices already contain tax — tax is forced to 0.
  pricesIncludeTax: boolean;
};

export type PersonBreakdown = {
  person: Person;
  items: { item: Item; share: number }[]; // share = this person's portion of that item
  subtotal: number; // sum of item shares, before extras
  discountShare: number; // this person's slice of the discount (amount taken OFF)
  taxShare: number;
  serviceShare: number;
  tipShare: number;
  total: number; // subtotal - discountShare + extras shares
};

export type SplitResult = {
  people: PersonBreakdown[];
  itemsSubtotal: number;
  discount: number; // total discount taken off (positive number)
  tax: number;
  service: number;
  tip: number;
  grandTotal: number;
  unassignedItemIds: string[];
};

// Round to the smallest currency unit. For VND that's 1; for USD/EUR, 1 cent.
// The epsilon nudge corrects binary-float error: e.g. 18.275/0.01 evaluates
// to 1827.49999…8, which plain Math.round would wrongly round DOWN to 18.27
// even though the exact half-cent should round UP to 18.28.
export function roundMoney(value: number, smallestUnit = 1): number {
  const units = value / smallestUnit;
  return (
    Math.round(units + Number.EPSILON * Math.max(1, Math.abs(units))) *
    smallestUnit
  );
}

/**
 * Split a bill.
 *
 * - Each item's line total (price * qty) is divided evenly among its assignees.
 * - The discount (fixed or %) comes off the items subtotal first; tax / service
 *   are computed on the discounted subtotal and split in proportion to each
 *   person's subtotal. The discount is split the same proportional way.
 * - Tip is either tipPercent % of the subtotal, or tipFixed, then split the
 *   same proportional way.
 * - Every share is a whole number of units; leftovers go by largest
 *   remainder, so the parts sum exactly to grandTotal (someone who ordered
 *   nothing always pays 0).
 */
export function splitBill(
  people: Person[],
  items: Item[],
  extras: Extras,
  smallestUnit = 1
): SplitResult {
  const r = (n: number) => roundMoney(n, smallestUnit);
  const allocate = (amount: number, weights: number[]) =>
    allocateUnits(amount, weights, smallestUnit);

  // 1. Per-person item shares. Each line total is split into whole units
  // (a 1-cent remainder goes to the first assignee), so shares add up exactly.
  const shares = new Map<string, number>();
  for (const p of people) shares.set(p.id, 0);
  const itemShares = new Map<string, Map<string, number>>();

  const unassignedItemIds: string[] = [];
  let itemsSubtotal = 0;
  let billedSubtotal = 0; // sum of rounded line totals
  let unassignedSubtotal = 0;

  for (const item of items) {
    const lineTotal = item.price * item.qty;
    itemsSubtotal += lineTotal;
    billedSubtotal += r(lineTotal);
    // Ids of removed people don't count: an item only they had is unassigned.
    const assignees = item.assignedTo.filter((pid) => shares.has(pid));
    if (assignees.length === 0) {
      unassignedItemIds.push(item.id);
      unassignedSubtotal += r(lineTotal);
      continue;
    }
    const split = allocate(lineTotal, assignees.map(() => 1));
    itemShares.set(item.id, new Map(assignees.map((pid, i) => [pid, split[i]])));
    assignees.forEach((pid, i) => shares.set(pid, (shares.get(pid) ?? 0) + split[i]));
  }

  // 2. Discount (off the items subtotal), then extras computed on the
  // discounted subtotal — that's how restaurant receipts do it.
  const discount =
    extras.discountType === "fixed"
      ? extras.discountValue
      : (itemsSubtotal * extras.discountValue) / 100;
  const rDiscount = r(Math.min(itemsSubtotal, Math.max(0, discount)));
  const discountedSubtotal = Math.max(0, itemsSubtotal - rDiscount);

  const tax = (discountedSubtotal * extras.taxPercent) / 100;
  const service = (discountedSubtotal * extras.servicePercent) / 100;
  const tip =
    extras.tipFixed > 0
      ? extras.tipFixed
      : (discountedSubtotal * extras.tipPercent) / 100;

  // Round the extras FIRST, then build the grand total from the rounded
  // parts. Rounding the total independently would let the displayed
  // tax/service/tip sum disagree with the displayed total by 1 unit
  // (e.g. $16.90 + 5% + 15% shows $0.85 + $2.54 = $20.29 but total $20.28).
  const rTax = r(tax);
  const rService = r(service);
  const rTip = r(tip);
  const grandTotal = r(billedSubtotal - rDiscount + rTax + rService + rTip);

  // Each rounded extra is split into whole units in proportion to subtotals,
  // so a person's total is exactly the parts on their card, nobody who
  // ordered nothing pays anything, and no share can go negative. Unassigned
  // items keep their own portion (the last weight) until someone takes them.
  // If every item is free (only a fixed tip costs anything), split it evenly
  // among the people who had items.
  let weights = [...people.map((p) => shares.get(p.id) ?? 0), unassignedSubtotal];
  if (weights.every((w) => w === 0)) {
    const hadItems = new Set([...itemShares.values()].flatMap((m) => [...m.keys()]));
    weights = [...people.map((p) => (hadItems.has(p.id) ? 1 : 0)), unassignedItemIds.length > 0 ? 1 : 0];
  }
  const taxShares = allocate(rTax, weights);
  const serviceShares = allocate(rService, weights);
  const tipShares = allocate(rTip, weights);
  const discountShares = allocate(rDiscount, weights);

  const peopleBreakdown: PersonBreakdown[] = people.map((p, i) => {
    const subtotal = shares.get(p.id) ?? 0;
    return {
      person: p,
      items: items
        .filter((it) => itemShares.get(it.id)?.has(p.id))
        .map((it) => ({ item: it, share: itemShares.get(it.id)?.get(p.id) ?? 0 })),
      subtotal,
      discountShare: discountShares[i],
      taxShare: taxShares[i],
      serviceShare: serviceShares[i],
      tipShare: tipShares[i],
      total: r(subtotal - discountShares[i] + taxShares[i] + serviceShares[i] + tipShares[i]),
    };
  });

  // When every item is assigned the shares already sum to grandTotal in whole
  // units; this only absorbs binary-float noise (e.g. 33.01 + 33 = 66.00999…)
  // so the sum compares equal. It never moves a real unit.
  const payer = peopleBreakdown.find((b) => b.total > 0);
  if (payer && unassignedItemIds.length === 0) {
    const others = peopleBreakdown.reduce((s, b) => (b === payer ? s : s + b.total), 0);
    payer.total = grandTotal - others;
  }

  return {
    people: peopleBreakdown,
    itemsSubtotal,
    discount: rDiscount,
    tax: rTax,
    service: rService,
    tip: rTip,
    grandTotal,
    unassignedItemIds,
  };
}

// Split `amount` (rounded to whole units) in proportion to `weights` using
// largest remainders: everyone gets a whole number of units, the parts sum
// exactly to the rounded amount, and zero weight always means zero.
function allocateUnits(amount: number, weights: number[], unit: number): number[] {
  const units = Math.round(roundMoney(amount, unit) / unit);
  const totalWeight = weights.reduce((s, w) => s + w, 0);
  if (units === 0 || totalWeight <= 0) return weights.map(() => 0);
  const exact = weights.map((w) => (units * w) / totalWeight);
  const whole = exact.map((x) => Math.floor(x + 1e-9));
  let left = units - whole.reduce((s, u) => s + u, 0);
  const byRemainder = exact
    .map((x, i) => ({ i, rem: x - whole[i] }))
    .sort((a, b) => b.rem - a.rem);
  for (let k = 0; left > 0; k++, left--) whole[byRemainder[k].i] += 1;
  return whole.map((u) => roundMoney(u * unit, unit));
}

/** Format a number as currency. VND: 125000 -> "125.000đ", USD/EUR: 12.5 -> "$12.50". */
export function formatMoney(amount: number, currency: Currency): string {
  if (currency === "VND") {
    // Dot as thousands separator, no decimals, suffix đ.
    return `${Math.round(amount).toLocaleString("de-DE")}đ`;
  }
  const symbol = currency === "USD" ? "$" : "€";
  return `${symbol}${amount.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

/** Build the plain-text summary for copying into chat apps. */
export function buildSummaryText(
  result: SplitResult,
  currency: Currency
): string {
  const lines = result.people.map(
    (b) => `${b.person.name}: ${formatMoney(b.total, currency)}`
  );
  // Show the total the per-person shares actually add up to (the rounded
  // grand total), not the raw grand total — otherwise the pasted total can
  // disagree with the pasted shares by a cent.
  const total =
    result.people.length > 0
      ? result.people.reduce((s, b) => s + b.total, 0)
      : result.grandTotal;
  lines.push(`Total: ${formatMoney(total, currency)}`);
  if (result.unassignedItemIds.length > 0) {
    lines.push(
      `⚠️ ${result.unassignedItemIds.length} item(s) not assigned to anyone — assign them in SplitSnap first.`
    );
  }
  return lines.join("\n");
}
