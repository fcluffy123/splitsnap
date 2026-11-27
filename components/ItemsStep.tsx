"use client";

// Step 2: scan a receipt or add items manually (name, price, quantity), then
// tap people chips under each item to assign it. An item shared by several
// people is split evenly between them.
import type { Item, Person } from "@/lib/split";
import type { ScannedReceipt } from "@/lib/scan";
import EmptyState from "./EmptyState";
import ScanButton from "./ScanButton";
import { card, input, primaryBtn, textOn } from "./ui";

type Props = {
  people: Person[];
  items: Item[];
  onChange: (items: Item[]) => void;
  onScanned: (receipt: ScannedReceipt, startedBillVersion: number) => void;
  getBillVersion: () => number;
  scanCheck: { scannedTotal: number; computedTotal: number } | null;
  onScanCheck: (check: { scannedTotal: number; computedTotal: number } | null) => void;
};

export default function ItemsStep({ people, items, onChange, onScanned, getBillVersion, scanCheck }: Props) {
  // The scanned receipt is handed up to the page (which owns the state and
  // guards against scans finishing after a "New bill" reset).

  const addItem = (name: string, price: string, qty: string) => {
    const trimmed = name.trim();
    const p = parseFloat(price);
    const q = parseInt(qty, 10);
    if (!trimmed || !Number.isFinite(p) || p <= 0 || !Number.isFinite(q) || q <= 0) return;
    onChange([...items, { id: `i${Date.now()}${Math.floor(Math.random() * 1000)}`, name: trimmed, price: p, qty: q, assignedTo: [] }]);
  };

  const updateItem = (id: string, patch: Partial<Item>) => {
    onChange(items.map((it) => (it.id === id ? { ...it, ...patch } : it)));
  };

  const removeItem = (id: string) => {
    onChange(items.filter((it) => it.id !== id));
  };

  const toggleAssign = (item: Item, personId: string) => {
    const assigned = item.assignedTo.includes(personId)
      ? item.assignedTo.filter((id) => id !== personId)
      : [...item.assignedTo, personId];
    updateItem(item.id, { assignedTo: assigned });
  };

  const unassigned = items.filter((it) => it.assignedTo.length === 0).length;
  // Warn only when the scanned total is really off: more than 1% OR more
  // than 1,000 (a unit like đ) away from the computed grand total.
  const diff = scanCheck ? Math.abs(scanCheck.scannedTotal - scanCheck.computedTotal) : 0;
  const withinTolerance = diff <= Math.max(scanCheck ? scanCheck.computedTotal * 0.01 : 0, 1000);
  const scanMatches = scanCheck ? withinTolerance : false;

  return (
    <div className="space-y-4">
      <ScanButton onScanned={onScanned} getBillVersion={getBillVersion} />

      {/* Sanity check: does the scanned bill total match the sum of scanned items? */}
      {scanCheck && (
        <p
          role="status"
          className={`motion-safe:animate-step-in rounded-2xl border px-4 py-3 text-sm ${
            scanMatches
              ? "border-emerald-200 bg-emerald-50 text-emerald-800"
              : "border-accent-400/60 bg-accent-100 text-amber-900"
          }`}
        >
          {scanMatches
            ? `✓ Scanned total matches the computed total (${scanCheck.computedTotal.toLocaleString("de-DE")})`
            : `⚠ Scanned total ${scanCheck.scannedTotal.toLocaleString("de-DE")} ≠ computed total ${scanCheck.computedTotal.toLocaleString("de-DE")} — check tax, service or items`}
        </p>
      )}

      {/* Manual entry */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const f = e.currentTarget.elements;
          addItem(
            (f.namedItem("name") as HTMLInputElement).value,
            (f.namedItem("price") as HTMLInputElement).value,
            (f.namedItem("qty") as HTMLInputElement).value
          );
          (f.namedItem("name") as HTMLInputElement).value = "";
          (f.namedItem("price") as HTMLInputElement).value = "";
          (f.namedItem("qty") as HTMLInputElement).value = "1";
          (f.namedItem("name") as HTMLInputElement).focus();
        }}
        className={`${card} space-y-2`}
      >
        <p className="text-sm font-semibold text-stone-500">…or add an item by hand</p>
        <label className="block">
          <span className="sr-only">Item name</span>
          <input name="name" placeholder="Item (e.g. Phở bò)" required autoComplete="off" className={input} />
        </label>
        <div className="grid grid-cols-[1fr_5rem_auto] gap-2">
          <label>
            <span className="sr-only">Unit price</span>
            <input name="price" type="number" inputMode="decimal" min="0" step="any" placeholder="Price" required className={input} />
          </label>
          <label>
            <span className="sr-only">Quantity</span>
            <input name="qty" type="number" inputMode="numeric" min="1" step="1" defaultValue="1" required className={`${input} text-center`} />
          </label>
          <button type="submit" aria-label="Add item" className={`${primaryBtn} text-2xl`}>
            +
          </button>
        </div>
      </form>

      {unassigned > 0 && (
        <p role="status" className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          👆 {unassigned} item{unassigned > 1 ? "s need" : " needs"} someone — tap a name under {unassigned > 1 ? "each" : "it"}.
        </p>
      )}

      {items.length === 0 ? (
        <EmptyState icon="🍜" title="No items yet">
          Scan the receipt or type the first item above.
        </EmptyState>
      ) : (
        <ul className="space-y-3">
          {items.map((item) => (
            <li
              key={item.id}
              className={`${card} motion-safe:animate-row-in transition-colors ${
                item.assignedTo.length === 0 ? "border-red-200" : ""
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-lg font-semibold">{item.name}</p>
                  <p className="text-sm text-stone-500">
                    {item.qty} × {item.price.toLocaleString("de-DE")} ={" "}
                    <span className="font-semibold text-stone-800">
                      {(item.price * item.qty).toLocaleString("de-DE")}
                    </span>
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => removeItem(item.id)}
                  aria-label={`Remove ${item.name}`}
                  className="-mr-2 -mt-2 flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-stone-400 transition hover:bg-stone-100 hover:text-stone-700"
                >
                  ✕
                </button>
              </div>

              {/* Who had it? Each chip is a toggle. */}
              <div role="group" aria-label={`Who had ${item.name}`} className="mt-3 flex flex-wrap gap-2">
                {people.map((p) => {
                  const active = item.assignedTo.includes(p.id);
                  return (
                    <button
                      key={p.id}
                      type="button"
                      aria-pressed={active}
                      onClick={() => toggleAssign(item, p.id)}
                      className={`min-h-11 rounded-full px-4 text-base font-semibold transition duration-150 active:scale-95 ${
                        active ? "shadow-sm" : "bg-stone-100 text-stone-500 hover:bg-stone-200"
                      }`}
                      style={active ? { backgroundColor: p.color, color: textOn(p.color) } : undefined}
                    >
                      {active && <span aria-hidden>✓ </span>}
                      {p.name}
                    </button>
                  );
                })}
              </div>
              {item.assignedTo.length === 0 && (
                <p className="mt-2 text-sm font-medium text-red-600">Not assigned to anyone yet</p>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
