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
};

export type PersonBreakdown = {
  person: Person;
  items: { item: Item; share: number }[]; // share = this person's portion of that item
  subtotal: number; // sum of item shares, before extras
  taxShare: number;
  serviceShare: number;
  tipShare: number;
  total: number; // subtotal + extras shares
};

export type SplitResult = {
  people: PersonBreakdown[];
  itemsSubtotal: number;
  tax: number;
  service: number;
  tip: number;
  grandTotal: number;
  unassignedItemIds: string[];
  // The bill's grand total must equal the sum of everyone's total, exactly.
  // Any rounding leftover is placed on the first person who ordered something.
  roundingAdjustment: number;
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
 * - Tax / service are computed on the items subtotal and split in proportion
 *   to each person's subtotal.
 * - Tip is either tipPercent % of the subtotal, or tipFixed, then split the
 *   same proportional way.
 * - The first person with items absorbs the rounding leftover so the parts
 *   sum exactly to grandTotal (someone who ordered nothing always pays 0).
 */
export function splitBill(
  people: Person[],
  items: Item[],
  extras: Extras,
  smallestUnit = 1
): SplitResult {
  // 1. Per-person item shares.
  const shares = new Map<string, number>();
  for (const p of people) shares.set(p.id, 0);

  const unassignedItemIds: string[] = [];
  let itemsSubtotal = 0;

  for (const item of items) {
    const lineTotal = item.price * item.qty;
    itemsSubtotal += lineTotal;
    if (item.assignedTo.length === 0) {
      unassignedItemIds.push(item.id);
      continue;
    }
    const perPerson = lineTotal / item.assignedTo.length;
    for (const pid of item.assignedTo) {
      if (shares.has(pid)) shares.set(pid, (shares.get(pid) ?? 0) + perPerson);
    }
  }

  // 2. Extras, proportional to each person's subtotal.
  const tax = (itemsSubtotal * extras.taxPercent) / 100;
  const service = (itemsSubtotal * extras.servicePercent) / 100;
  const tip =
    extras.tipFixed > 0
      ? extras.tipFixed
      : (itemsSubtotal * extras.tipPercent) / 100;

  const r = (n: number) => roundMoney(n, smallestUnit);

  // Round the extras FIRST, then build the grand total from the rounded
  // parts. Rounding the total independently would let the displayed
  // tax/service/tip sum disagree with the displayed total by 1 unit
  // (e.g. $16.90 + 5% + 15% shows $0.85 + $2.54 = $20.29 but total $20.28).
  const rTax = r(tax);
  const rService = r(service);
  const rTip = r(tip);
  const exactGrand = itemsSubtotal + rTax + rService + rTip;

  // Weight each person's share by the ROUNDED extras, the same ones the
  // grand total is built from. Weighting by the raw extras would make the
  // per-person totals target a different bill than grandTotal.
  const extrasTotal = rTax + rService + rTip;

  // Raw (unrounded) total per person: subtotal + proportional extras.
  // If the whole bill is unassigned (itemsSubtotal = 0) nobody gets extras.
  const rawTotal = (pid: string) => {
    const subtotal = shares.get(pid) ?? 0;
    const prop = itemsSubtotal > 0 ? subtotal / itemsSubtotal : 0;
    return subtotal + extrasTotal * prop;
  };

  const peopleBreakdown: PersonBreakdown[] = people.map((p) => {
    const subtotal = shares.get(p.id) ?? 0;
    const prop = itemsSubtotal > 0 ? subtotal / itemsSubtotal : 0;
    return {
      person: p,
      items: items
        .filter((it) => it.assignedTo.includes(p.id))
        .map((it) => ({ item: it, share: (it.price * it.qty) / it.assignedTo.length })),
      subtotal,
      taxShare: r(rTax * prop),
      serviceShare: r(rService * prop),
      tipShare: r(rTip * prop),
      total: r(rawTotal(p.id)),
    };
  });

  // The first person who ordered something absorbs the rounding leftover so
  // the parts sum exactly to the rounded grand total. Falls back to the first
  // person only when nobody has items (then every total is 0 anyway).
  let roundingAdjustment = 0;
  if (peopleBreakdown.length > 0) {
    const absorber = Math.max(
      0,
      peopleBreakdown.findIndex((b) => b.subtotal > 0)
    );
    const sum = peopleBreakdown.reduce((s, b) => s + b.total, 0);
    roundingAdjustment = exactGrand - sum;
    peopleBreakdown[absorber].total += roundingAdjustment;
  }

  // The grand total is built from the rounded parts above, so the displayed
  // tax/service/tip always add up to the displayed total, and the per-person
  // totals (with one diner absorbing the leftover) sum to it exactly.
  return {
    people: peopleBreakdown,
    itemsSubtotal,
    tax: rTax,
    service: rService,
    tip: rTip,
    grandTotal: exactGrand,
    unassignedItemIds,
    roundingAdjustment,
  };
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
