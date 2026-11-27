"use client";

// Step 2: add items manually (name, price, quantity) and tap people chips
// under each item to assign it. An item shared by several people is split
// evenly between them.
import type { Item, Person } from "@/lib/split";
import type { ScannedReceipt } from "@/lib/scan";
import ScanButton from "./ScanButton";

type Props = {
  people: Person[];
  items: Item[];
  onChange: (items: Item[]) => void;
  onScanned: (receipt: ScannedReceipt) => void;
  scanCheck: { scannedTotal: number; itemsTotal: number } | null;
  onScanCheck: (check: { scannedTotal: number; itemsTotal: number } | null) => void;
};

export default function ItemsStep({ people, items, onChange, onScanned, scanCheck, onScanCheck }: Props) {
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

  return (
    <div className="space-y-4">
      <p className="text-stone-600">Add each item, then tap who had it.</p>

      <ScanButton onScanned={onScanned} />

      {/* Sanity check: does the scanned bill total match the sum of scanned items? */}
      {scanCheck && (
        <p
          className={`rounded-xl px-4 py-3 ${
            Math.abs(scanCheck.scannedTotal - scanCheck.itemsTotal) < 1
              ? "bg-green-50 border border-green-200 text-green-700"
              : "bg-amber-50 border border-amber-300 text-amber-800"
          }`}
        >
          {Math.abs(scanCheck.scannedTotal - scanCheck.itemsTotal) < 1
            ? `✓ Scanned total matches items (${scanCheck.itemsTotal.toLocaleString("de-DE")})`
            : `⚠ Scanned total ${scanCheck.scannedTotal.toLocaleString("de-DE")} ≠ items total ${scanCheck.itemsTotal.toLocaleString("de-DE")} — check the items below`}
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
        className="grid grid-cols-[1fr_110px_70px_auto] gap-2"
      >
        <input name="name" placeholder="Item" required
          className="rounded-xl border border-stone-300 bg-white px-3 py-3 outline-none focus:border-amber-500" />
        <input name="price" type="number" min="0" step="any" placeholder="Price" required
          className="rounded-xl border border-stone-300 bg-white px-3 py-3 outline-none focus:border-amber-500" />
        <input name="qty" type="number" min="1" step="1" defaultValue="1" required
          className="rounded-xl border border-stone-300 bg-white px-3 py-3 outline-none focus:border-amber-500" />
        <button type="submit"
          className="rounded-xl bg-amber-500 px-4 py-3 font-semibold text-white active:bg-amber-600">
          +
        </button>
      </form>

      <ul className="space-y-3">
        {items.map((item) => (
          <li key={item.id} className="rounded-2xl border border-stone-200 bg-white p-4">
            <div className="flex items-center justify-between gap-2">
              <div>
                <p className="font-semibold text-lg">{item.name}</p>
                <p className="text-stone-500">
                  {item.qty} × {item.price.toLocaleString("de-DE")} ={" "}
                  <span className="font-medium text-stone-800">
                    {(item.price * item.qty).toLocaleString("de-DE")}
                  </span>
                </p>
              </div>
              <button
                onClick={() => removeItem(item.id)}
                aria-label={`Remove ${item.name}`}
                className="rounded-lg bg-stone-100 px-3 py-2 text-stone-500"
              >
                ✕
              </button>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {people.map((p) => {
                const active = item.assignedTo.includes(p.id);
                return (
                  <button
                    key={p.id}
                    onClick={() => toggleAssign(item, p.id)}
                    className={`rounded-full px-4 py-2 text-base font-medium transition-opacity ${
                      active ? "text-white" : "bg-stone-100 text-stone-500 opacity-60"
                    }`}
                    style={active ? { backgroundColor: p.color } : undefined}
                  >
                    {p.name}
                  </button>
                );
              })}
            </div>
            {item.assignedTo.length === 0 && (
              <p className="mt-2 text-sm text-red-600">Not assigned to anyone yet</p>
            )}
          </li>
        ))}
      </ul>

      {items.length === 0 && (
        <p className="rounded-xl bg-stone-100 px-4 py-3 text-stone-500">
          No items yet — add the first one above.
        </p>
      )}
    </div>
  );
}
