"use client";

// Step 4: a grand-total card, then one card per person — avatar, bold total,
// the items they had and their share of tax/service/tip.
// Warns about unassigned items and shows friendly empty states.
import {
  splitBill,
  formatMoney,
  smallestUnit,
  type Currency,
  type Extras,
  type Item,
  type Person,
} from "@/lib/split";
import AnimatedNumber from "./AnimatedNumber";
import EmptyState from "./EmptyState";
import { card, initial, secondaryBtn, textOn } from "./ui";

type Props = {
  people: Person[];
  items: Item[];
  extras: Extras;
  currency: Currency;
  onGoTo: (step: number) => void; // jump back to fix a problem
};

export default function ResultsStep({ people, items, extras, currency, onGoTo }: Props) {
  const result = splitBill(people, items, extras, smallestUnit(currency));
  const fmt = (n: number) => formatMoney(n, currency);

  if (people.length === 0 || items.length === 0) {
    const noPeople = people.length === 0;
    return (
      <EmptyState
        icon={noPeople ? "👥" : "🧾"}
        title={noPeople ? "Add people first" : "Nothing to split yet"}
      >
        <p>{noPeople ? "Tell us who's at the table." : "Scan a receipt or add items to see who owes what."}</p>
        <button type="button" onClick={() => onGoTo(noPeople ? 0 : 1)} className={`${secondaryBtn} mt-3 bg-white`}>
          {noPeople ? "Add people" : "Add items"}
        </button>
      </EmptyState>
    );
  }

  const unassigned = result.unassignedItemIds.length;
  const extrasRows = [
    ["Tax", result.tax],
    ["Service", result.service],
    ["Tip", result.tip],
  ] as const;

  return (
    <div className="space-y-4">
      {unassigned > 0 && (
        <div role="alert" className="flex items-center gap-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-red-800">
          <p className="flex-1 text-sm">
            ⚠️ {unassigned} item{unassigned > 1 ? "s are" : " is"} not assigned to anyone and
            won't be counted in anyone's share.
          </p>
          <button
            type="button"
            onClick={() => onGoTo(1)}
            className="min-h-11 shrink-0 rounded-xl bg-white px-3 text-sm font-semibold text-red-700 ring-1 ring-red-200"
          >
            Fix it
          </button>
        </div>
      )}

      {/* Grand total */}
      <section
        aria-label="Bill total"
        className="motion-safe:animate-row-in rounded-3xl bg-gradient-to-br from-brand-600 to-brand-900 p-5 text-white shadow-lift"
      >
        <p className="text-sm font-medium text-brand-100">Bill total</p>
        <p className="mt-1 text-4xl font-extrabold tracking-tight">
          <AnimatedNumber value={result.grandTotal} format={fmt} />
        </p>
        <p className="mt-1 text-sm text-brand-100">
          Split between {people.length} people
        </p>
        <dl className="mt-4 grid grid-cols-4 gap-2 border-t border-white/15 pt-3 text-xs">
          <div>
            <dt className="text-brand-200">Items</dt>
            <dd className="mt-0.5 font-semibold tabular-nums">{fmt(result.itemsSubtotal)}</dd>
          </div>
          {extrasRows.map(([label, value]) => (
            <div key={label}>
              <dt className="text-brand-200">{label}</dt>
              <dd className="mt-0.5 font-semibold tabular-nums">{fmt(value)}</dd>
            </div>
          ))}
        </dl>
      </section>

      {/* One card per person; rows slide in one after another */}
      <ul className="space-y-3" aria-label="Who owes what">
        {result.people.map((b, i) => (
          <li
            key={b.person.id}
            className={`${card} motion-safe:animate-row-in ${b.items.length === 0 ? "opacity-70" : ""}`}
            style={{ animationDelay: `${80 + i * 60}ms` }}
          >
            <div className="flex items-center gap-3">
              <span
                aria-hidden
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-lg font-bold"
                style={{ backgroundColor: b.person.color, color: textOn(b.person.color) }}
              >
                {initial(b.person.name)}
              </span>
              <div className="min-w-0 flex-1">
                <h3 className="truncate text-lg font-bold">{b.person.name}</h3>
                <p className="text-xs text-stone-500">
                  {b.items.length === 0
                    ? "Nothing assigned"
                    : `${b.items.length} item${b.items.length > 1 ? "s" : ""}`}
                </p>
              </div>
              <span className="text-2xl font-extrabold tracking-tight text-stone-900">
                <AnimatedNumber value={b.total} format={fmt} />
              </span>
            </div>

            {b.items.length > 0 && (
              <>
                <ul className="mt-3 space-y-1 text-sm text-stone-700">
                  {b.items.map(({ item, share }) => (
                    <li key={item.id} className="flex justify-between gap-2">
                      <span className="min-w-0 truncate">
                        {item.name} ×{item.qty}
                        {item.assignedTo.length > 1 && (
                          <span className="text-stone-400"> · shared ÷{item.assignedTo.length}</span>
                        )}
                      </span>
                      <span className="tabular-nums">{fmt(share)}</span>
                    </li>
                  ))}
                </ul>

                <dl className="mt-3 space-y-0.5 border-t border-dashed border-stone-200 pt-2 text-xs text-stone-500">
                  {[
                    ["Subtotal", b.subtotal],
                    ["Tax", b.taxShare],
                    ["Service", b.serviceShare],
                    ["Tip", b.tipShare],
                  ]
                    // Hide extras that don't apply (e.g. no tip) to keep cards short.
                    .filter(([label, value]) => label === "Subtotal" || value !== 0)
                    .map(([label, value]) => (
                    <div key={label} className="flex justify-between">
                      <dt>{label}</dt>
                      <dd className="tabular-nums">{fmt(value as number)}</dd>
                    </div>
                  ))}
                </dl>
              </>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
