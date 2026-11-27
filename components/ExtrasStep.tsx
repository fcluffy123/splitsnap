"use client";

// Step 3: tax %, service charge % and tip (% or fixed amount).
// These are split in proportion to each person's subtotal (see lib/split.ts).
import type { Currency, Extras } from "@/lib/split";
import { card, input } from "./ui";

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
      <span className="mb-1 block text-sm font-semibold text-stone-600">{label}</span>
      <div className="relative">
        <input
          type="number"
          inputMode="decimal"
          min="0"
          step="any"
          value={value}
          onChange={(e) => onInput(num(e.target.value))}
          className={`${input} pr-10`}
        />
        <span aria-hidden className="pointer-events-none absolute inset-y-0 right-4 flex items-center text-stone-400">
          {suffix}
        </span>
      </div>
    </label>
  );

  return (
    <div className="space-y-4">
      <div className={`${card} space-y-4`}>
        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="mb-1 block text-sm font-semibold text-stone-600">Discount</span>
            <div className="relative">
              <input
                type="number"
                inputMode="decimal"
                min="0"
                step="any"
                value={extras.discountValue}
                onChange={(e) => set({ discountValue: num(e.target.value) })}
                className={`${input} pr-14`}
              />
              <select
                aria-label="Discount unit"
                value={extras.discountType}
                onChange={(e) => set({ discountType: e.target.value === "percent" ? "percent" : "fixed" })}
                className="absolute inset-y-1 right-1 rounded-lg bg-transparent pr-1 text-sm text-stone-400 appearance-none"
              >
                <option value="fixed">{fixedSuffix}</option>
                <option value="percent">%</option>
              </select>
            </div>
          </label>
          <div className="self-end pb-1">
            <label className="flex min-h-11 items-center gap-3">
              <input
                type="checkbox"
                checked={extras.pricesIncludeTax}
                onChange={(e) => set({ pricesIncludeTax: e.target.checked, taxPercent: e.target.checked ? 0 : extras.taxPercent })}
                className="h-5 w-5 accent-stone-800"
              />
              <span className="text-sm font-semibold text-stone-600">Prices include tax</span>
            </label>
            {extras.pricesIncludeTax && (
              <p className="mt-1 text-xs text-stone-400">Tax is set to 0 — the printed total already has it baked in.</p>
            )}
          </div>
        </div>
        {field("Tax", extras.taxPercent, (n) => set({ taxPercent: extras.pricesIncludeTax ? 0 : n }), "%")}
        {field("Service charge", extras.servicePercent, (n) => set({ servicePercent: n }), "%")}
        <p className="text-sm text-stone-500">
          The discount comes off the items total first; tax and service are then calculated on the discounted amount.
        </p>
      </div>

      <div className={`${card} space-y-3`}>
        <div className="grid grid-cols-2 gap-3">
          {field("Tip", extras.tipPercent, (n) => set({ tipPercent: n, tipFixed: 0 }), "%")}
          {field("…or fixed tip", extras.tipFixed, (n) => set({ tipFixed: n, tipPercent: 0 }), fixedSuffix)}
        </div>
        <p className="text-sm text-stone-500">
          Fill in either the % or the fixed amount — the other one is ignored.
        </p>
      </div>
    </div>
  );
}
