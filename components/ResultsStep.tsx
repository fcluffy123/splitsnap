"use client";

// Results: a grand-total card, then one scannable row per person (avatar
// initials + total) that expands to show their items and extras shares.
// Warns about unassigned items.
import {
  splitBill,
  formatMoney,
  smallestUnit,
  type Currency,
  type Extras,
  type Item,
  type Person,
} from "@/lib/split";

type Props = {
  people: Person[];
  items: Item[];
  extras: Extras;
  currency: Currency;
};

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const letters = parts.length > 1 ? parts[0][0] + parts[parts.length - 1][0] : (parts[0] ?? "?").slice(0, 2);
  return letters.toUpperCase();
}

export default function ResultsStep({ people, items, extras, currency }: Props) {
  const fmt = (n: number) => formatMoney(n, currency);

  if (people.length === 0 || items.length === 0) {
    return (
      <div className="rounded-3xl border-2 border-dashed border-stone-200 px-4 py-10 text-center text-stone-500">
        <p className="text-4xl" aria-hidden="true">🧮</p>
        <p className="mt-2 font-semibold text-stone-700">Nothing to split yet</p>
        <p className="text-sm">
          {items.length === 0 ? "Add some items on the Scan step first." : "Add people on the Assign step first."}
        </p>
      </div>
    );
  }

  const result = splitBill(people, items, extras, smallestUnit(currency));
  const extrasRows = [
    { label: "Tax", value: result.tax },
    { label: "Service", value: result.service },
    { label: "Tip", value: result.tip },
  ].filter((r) => r.value > 0);

  return (
    <div className="space-y-4">
      {result.unassignedItemIds.length > 0 && (
        <div role="alert" className="rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-700 ring-1 ring-rose-200">
          ⚠️ {result.unassignedItemIds.length} item
          {result.unassignedItemIds.length > 1 ? "s are" : " is"} not assigned to anyone
          and won't be counted in anyone's share. Go back to fix it.
        </div>
      )}

      {/* Grand total */}
      <section
        aria-label="Bill total"
        className="rounded-3xl bg-gradient-to-br from-amber-400 to-orange-500 p-5 text-white shadow-lg shadow-orange-200"
      >
        <p className="text-sm font-medium text-white/85">Bill total</p>
        <p className="text-4xl font-extrabold tracking-tight">{fmt(result.grandTotal)}</p>
        <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-sm text-white/90">
          <dt>Items</dt>
          <dd className="text-right font-semibold">{fmt(result.itemsSubtotal)}</dd>
          {extrasRows.map((r) => (
            <div key={r.label} className="contents">
              <dt>{r.label}</dt>
              <dd className="text-right font-semibold">{fmt(r.value)}</dd>
            </div>
          ))}
        </dl>
      </section>

      {/* Per-person rows */}
      <ul className="space-y-3" aria-label="What each person owes">
        {result.people.map((b) => (
          <li key={b.person.id} className="rounded-3xl bg-white shadow-sm ring-1 ring-stone-100">
            <details className="group">
              <summary className="flex min-h-16 cursor-pointer list-none items-center gap-3 rounded-3xl p-4 [&::-webkit-details-marker]:hidden">
                <span
                  aria-hidden="true"
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-sm font-bold text-stone-900"
                  style={{ backgroundColor: `${b.person.color}33`, boxShadow: `inset 0 0 0 2px ${b.person.color}` }}
                >
                  {initials(b.person.name)}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-lg font-semibold">{b.person.name}</span>
                  <span className="block text-xs text-stone-500">
                    {b.items.length} item{b.items.length === 1 ? "" : "s"}
                  </span>
                </span>
                <span className="text-xl font-bold tabular-nums">{fmt(b.total)}</span>
                <span
                  aria-hidden="true"
                  className="text-stone-400 transition-transform duration-200 group-open:rotate-180"
                >
                  ▾
                </span>
              </summary>

              <div className="border-t border-stone-100 px-4 pt-3 pb-4 text-sm">
                {b.items.length > 0 ? (
                  <ul className="space-y-1 text-stone-600">
                    {b.items.map(({ item, share }) => (
                      <li key={item.id} className="flex justify-between gap-2">
                        <span>
                          {item.name} ×{item.qty}
                          {item.assignedTo.length > 1 && (
                            <span className="text-stone-400"> (shared ×{item.assignedTo.length})</span>
                          )}
                        </span>
                        <span className="tabular-nums">{fmt(share)}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-stone-500">No items assigned.</p>
                )}
                <dl className="mt-3 space-y-1 border-t border-stone-100 pt-2 text-stone-500">
                  <div className="flex justify-between"><dt>Subtotal</dt><dd className="tabular-nums">{fmt(b.subtotal)}</dd></div>
                  <div className="flex justify-between"><dt>Tax share</dt><dd className="tabular-nums">{fmt(b.taxShare)}</dd></div>
                  <div className="flex justify-between"><dt>Service share</dt><dd className="tabular-nums">{fmt(b.serviceShare)}</dd></div>
                  <div className="flex justify-between"><dt>Tip share</dt><dd className="tabular-nums">{fmt(b.tipShare)}</dd></div>
                </dl>
              </div>
            </details>
          </li>
        ))}
      </ul>
    </div>
  );
}
