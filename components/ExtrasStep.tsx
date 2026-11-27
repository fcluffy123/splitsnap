"use client";

// Tax %, service charge % and tip (% or fixed amount), on the Assign step.
// These are split in proportion to each person's subtotal (see lib/split.ts).
import type { Currency, Extras } from "@/lib/split";

type Props = {
  extras: Extras;
  currency: Currency;
  onChange: (extras: Extras) => void;
};

export default function ExtrasStep({ extras, currency, onChange }: Props) {
  const fixedSuffix = currency === "VND" ? "đ" : currency === "USD" ? "$" : "€";
  const set = (patch: Partial<Extras>) => onChange({ ...extras, ...patch });

  const num = (v: string) => {
    const n = parseFloat(v);
    return Number.isFinite(n) && n >= 0 ? n : 0;
  };

  const field = (
    label: string,
    value: number,
    onInput: (n: number) => void,
    suffix: string
  ) => (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-stone-700">{label}</span>
      <div className="flex items-center gap-2">
        <input
          type="number"
          min="0"
          step="any"
          value={value}
          onChange={(e) => onInput(num(e.target.value))}
          inputMode="decimal"
          className="min-h-11 w-full min-w-0 rounded-xl border border-stone-200 bg-stone-50 px-4 py-2 text-lg transition-colors focus:border-amber-400 focus:bg-white"
        />
        <span className="w-4 text-stone-500" aria-hidden="true">{suffix}</span>
      </div>
    </label>
  );

  return (
    <div className="space-y-4 rounded-3xl bg-white p-4 shadow-sm ring-1 ring-stone-100">
      <div>
        <h2 className="text-lg font-bold">Tax, service &amp; tip</h2>
        <p className="text-sm text-stone-500">
          Split in proportion to what each person ordered — not evenly.
        </p>
      </div>

      {field("Tax", extras.taxPercent, (n) => set({ taxPercent: n }), "%")}
      {field("Service charge", extras.servicePercent, (n) => set({ servicePercent: n }), "%")}

      <div className="grid grid-cols-2 gap-3">
        {field("Tip", extras.tipPercent, (n) => set({ tipPercent: n, tipFixed: 0 }), "%")}
        {field("…or fixed tip", extras.tipFixed, (n) => set({ tipFixed: n, tipPercent: 0 }), fixedSuffix)}
      </div>
      <p className="text-xs text-stone-500">
        Tip: fill in either the % or the fixed amount — the other one is ignored.
      </p>
    </div>
  );
}
