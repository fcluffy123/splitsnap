"use client";

// Step 4: one card per person — items, subtotal, share of tax/service/tip,
// and final total. Warns about unassigned items.
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

export default function ResultsStep({ people, items, extras, currency }: Props) {
  const result = splitBill(people, items, extras, smallestUnit(currency));
  const fmt = (n: number) => formatMoney(n, currency);

  return (
    <div className="space-y-4">
      {result.unassignedItemIds.length > 0 && (
        <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-red-700">
          ⚠️ {result.unassignedItemIds.length} item
          {result.unassignedItemIds.length > 1 ? "s are" : " is"} not assigned to anyone
          and won't be counted in anyone's share. Go back to fix it.
        </div>
      )}

      <div className="rounded-2xl bg-white border border-stone-200 p-4 text-sm text-stone-600 space-y-1">
        <p>Items subtotal: <b className="text-stone-900">{fmt(result.itemsSubtotal)}</b></p>
        <p>Tax: <b className="text-stone-900">{fmt(result.tax)}</b></p>
        <p>Service: <b className="text-stone-900">{fmt(result.service)}</b></p>
        <p>Tip: <b className="text-stone-900">{fmt(result.tip)}</b></p>
        <p className="border-t border-stone-200 pt-1 text-base">
          Bill total: <b className="text-stone-900">{fmt(result.grandTotal)}</b>
        </p>
      </div>

      {result.people.map((b) => (
        <div key={b.person.id} className="rounded-2xl bg-white border border-stone-200 p-4">
          <div className="flex items-center gap-2">
            <span
              className="inline-block h-4 w-4 rounded-full"
              style={{ backgroundColor: b.person.color }}
            />
            <h3 className="text-xl font-bold">{b.person.name}</h3>
            <span className="ml-auto text-xl font-bold">{fmt(b.total)}</span>
          </div>

          <ul className="mt-3 space-y-1 text-stone-600">
            {b.items.map(({ item, share }) => (
              <li key={item.id} className="flex justify-between gap-2">
                <span>
                  {item.name} ×{item.qty}
                  {item.assignedTo.length > 1 && (
                    <span className="text-stone-400"> (shared ×{item.assignedTo.length})</span>
                  )}
                </span>
                <span>{fmt(share)}</span>
              </li>
            ))}
          </ul>

          <div className="mt-3 space-y-1 border-t border-stone-100 pt-2 text-sm text-stone-500">
            <p className="flex justify-between"><span>Subtotal</span><span>{fmt(b.subtotal)}</span></p>
            <p className="flex justify-between"><span>Tax share</span><span>{fmt(b.taxShare)}</span></p>
            <p className="flex justify-between"><span>Service share</span><span>{fmt(b.serviceShare)}</span></p>
            <p className="flex justify-between"><span>Tip share</span><span>{fmt(b.tipShare)}</span></p>
          </div>
        </div>
      ))}
    </div>
  );
}
