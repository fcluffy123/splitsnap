"use client";

// Items list, used by two steps:
// - "scan": scan a receipt or add items manually (name, price, quantity).
// - "assign": tap people chips under each item to assign it. An item shared
//   by several people is split evenly between them.
import { formatMoney, type Currency, type Item, type Person } from "@/lib/split";
import type { ScannedReceipt } from "@/lib/scan";
import ScanButton from "./ScanButton";

type Props = {
  mode: "scan" | "assign";
  people: Person[];
  items: Item[];
  currency: Currency;
  onChange: (items: Item[]) => void;
  onScanned: (receipt: ScannedReceipt, startedBillVersion: number) => void;
  getBillVersion: () => number;
  scanCheck: { scannedTotal: number; itemsTotal: number } | null;
  onScanCheck: (check: { scannedTotal: number; itemsTotal: number } | null) => void;
};

const input =
  "min-h-11 min-w-0 rounded-xl border border-stone-200 bg-stone-50 px-3 py-2 transition-colors focus:border-amber-400 focus:bg-white";

export default function ItemsStep({ mode, people, items, currency, onChange, onScanned, getBillVersion, scanCheck }: Props) {
  // The scanned receipt is handed up to the page (which owns the state and
  // guards against scans finishing after a "New bill" reset).
  const fmt = (n: number) => formatMoney(n, currency);

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

  const unassignedCount = items.filter((it) => it.assignedTo.length === 0).length;
  const scanMatches = scanCheck && Math.abs(scanCheck.scannedTotal - scanCheck.itemsTotal) < 1;

  return (
    <div className="space-y-4">
      {mode === "scan" ? (
        <>
          <div>
            <h2 className="text-lg font-bold">What's on the bill?</h2>
            <p className="text-sm text-stone-500">Snap the receipt, or type items in yourself.</p>
          </div>

          <ScanButton onScanned={onScanned} getBillVersion={getBillVersion} />

          {/* Sanity check: does the scanned bill total match the sum of scanned items? */}
          {scanCheck && (
            <p
              role="status"
              className={`rounded-2xl px-4 py-3 text-sm ${
                scanMatches
                  ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200"
                  : "bg-amber-50 text-amber-800 ring-1 ring-amber-300"
              }`}
            >
              {scanMatches
                ? `✓ Scanned total matches items (${fmt(scanCheck.itemsTotal)})`
                : `⚠ Scanned total ${fmt(scanCheck.scannedTotal)} ≠ items total ${fmt(scanCheck.itemsTotal)} — check the items below`}
            </p>
          )}

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
            }}
            className="grid grid-cols-[1fr_96px_60px_auto] gap-2 rounded-3xl bg-white p-3 shadow-sm ring-1 ring-stone-100"
          >
            <input name="name" placeholder="Item" required aria-label="Item name" autoComplete="off" className={input} />
            <input name="price" type="number" min="0" step="any" placeholder="Price" required aria-label="Price" inputMode="decimal" className={input} />
            <input name="qty" type="number" min="1" step="1" defaultValue="1" required aria-label="Quantity" inputMode="numeric" className={input} />
            <button
              type="submit"
              aria-label="Add item"
              className="min-h-11 min-w-11 rounded-xl bg-amber-500 px-3 text-xl font-semibold text-white transition active:scale-[0.97] hover:bg-amber-600"
            >
              +
            </button>
          </form>
        </>
      ) : (
        <div>
          <h2 className="text-lg font-bold">Who had what?</h2>
          <p className="text-sm text-stone-500">Tap names under each item. Shared items split evenly.</p>
          {items.length > 0 && unassignedCount > 0 && (
            <p className="mt-2 text-sm font-medium text-rose-600">
              {unassignedCount} item{unassignedCount > 1 ? "s" : ""} still need{unassignedCount > 1 ? "" : "s"} someone.
            </p>
          )}
        </div>
      )}

      <ul className="space-y-3">
        {items.map((item) => (
          <li key={item.id} className="rounded-3xl bg-white p-4 shadow-sm ring-1 ring-stone-100 transition-shadow hover:shadow-md">
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate text-lg font-semibold">{item.name}</p>
                <p className="text-sm text-stone-500">
                  {item.qty} × {fmt(item.price)} ={" "}
                  <span className="font-semibold text-stone-800">{fmt(item.price * item.qty)}</span>
                </p>
              </div>
              {mode === "scan" && (
                <button
                  onClick={() => removeItem(item.id)}
                  aria-label={`Remove ${item.name}`}
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-stone-400 transition-colors hover:bg-rose-50 hover:text-rose-600"
                >
                  ✕
                </button>
              )}
            </div>
            {mode === "assign" && (
              <>
                <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label={`Who had ${item.name}`}>
                  {people.map((p) => {
                    const active = item.assignedTo.includes(p.id);
                    return (
                      <button
                        key={p.id}
                        onClick={() => toggleAssign(item, p.id)}
                        aria-pressed={active}
                        className={`min-h-11 rounded-full px-4 text-base font-medium transition duration-150 active:scale-95 ${
                          active ? "text-white shadow-sm" : "bg-stone-100 text-stone-500 hover:bg-stone-200"
                        }`}
                        style={active ? { backgroundColor: p.color } : undefined}
                      >
                        {active && <span aria-hidden="true">✓ </span>}
                        {p.name}
                      </button>
                    );
                  })}
                </div>
                {item.assignedTo.length === 0 && (
                  <p className="mt-2 text-sm text-rose-600">Not assigned to anyone yet</p>
                )}
              </>
            )}
          </li>
        ))}
      </ul>

      {items.length === 0 && (
        <div className="rounded-3xl border-2 border-dashed border-stone-200 px-4 py-8 text-center text-stone-500">
          <p className="text-3xl" aria-hidden="true">🍜</p>
          <p className="mt-2 font-medium">No items yet</p>
          <p className="text-sm">
            {mode === "scan" ? "Scan a receipt or add the first item above." : "Go back to Scan to add items."}
          </p>
        </div>
      )}
    </div>
  );
}
