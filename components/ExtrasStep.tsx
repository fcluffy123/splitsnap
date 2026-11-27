"use client";

// Step 3: tax %, service charge % and tip (% or fixed amount).
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
      <span className="mb-1 block font-medium">{label}</span>
      <div className="flex items-center gap-2">
        <input
          type="number"
          min="0"
          step="any"
          value={value}
          onChange={(e) => onInput(num(e.target.value))}
          className="w-full rounded-xl border border-stone-300 bg-white px-4 py-3 text-lg outline-none focus:border-amber-500"
        />
        <span className="text-stone-500">{suffix}</span>
      </div>
    </label>
  );

  return (
    <div className="space-y-4">
      <p className="text-stone-600">
        Extras are split in proportion to what each person ordered — not evenly.
      </p>

      {field("Tax", extras.taxPercent, (n) => set({ taxPercent: n }), "%")}
      {field("Service charge", extras.servicePercent, (n) => set({ servicePercent: n }), "%")}

      <div className="grid grid-cols-2 gap-3">
        {field("Tip", extras.tipPercent, (n) => set({ tipPercent: n, tipFixed: 0 }), "%")}
        {field("…or fixed tip", extras.tipFixed, (n) => set({ tipFixed: n, tipPercent: 0 }), fixedSuffix)}
      </div>
      <p className="text-sm text-stone-500">
        Tip: fill in either the % or the fixed amount — the other one is ignored.
      </p>
    </div>
  );
}
