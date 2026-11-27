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
  // Any rounding leftover is placed on the first person.
  roundingAdjustment: number;
};

// Round to the smallest currency unit. For VND that's 1; for USD/EUR, 1 cent.
export function roundMoney(value: number, smallestUnit = 1): number {
  return Math.round(value / smallestUnit) * smallestUnit;
}

/**
 * Split a bill.
 *
 * - Each item's line total (price * qty) is divided evenly among its assignees.
 * - Tax / service are computed on the items subtotal and split in proportion
 *   to each person's subtotal.
 * - Tip is either tipPercent % of the subtotal, or tipFixed, then split the
 *   same proportional way.
 * - The first person absorbs the rounding leftover so the parts sum exactly
 *   to grandTotal.
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
  const grandTotal = itemsSubtotal + tax + service + tip;

  const r = (n: number) => roundMoney(n, smallestUnit);
  const extrasTotal = tax + service + tip;

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
      taxShare: r(tax * prop),
      serviceShare: r(service * prop),
      tipShare: r(tip * prop),
      total: r(rawTotal(p.id)),
    };
  });

  // First person absorbs the rounding leftover so the parts sum exactly
  // to the rounded grand total.
  let roundingAdjustment = 0;
  if (peopleBreakdown.length > 0) {
    const othersSum = peopleBreakdown
      .slice(1)
      .reduce((s, b) => s + b.total, 0);
    const exactGrand = r(grandTotal);
    roundingAdjustment = exactGrand - othersSum - peopleBreakdown[0].total;
    peopleBreakdown[0].total += roundingAdjustment;
  }

  return {
    people: peopleBreakdown,
    itemsSubtotal,
    tax,
    service,
    tip,
    grandTotal,
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
  lines.push(`Total: ${formatMoney(roundMoney(result.grandTotal), currency)}`);
  return lines.join("\n");
}
