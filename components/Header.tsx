"use client";

// Friendly app header: logo, tagline and the currency switcher.
import { CURRENCIES, type Currency } from "@/lib/split";

type Props = {
  currency: Currency;
  onCurrency: (c: Currency) => void;
};

export default function Header({ currency, onCurrency }: Props) {
  return (
    <header className="mb-5 flex items-center gap-3">
      <div
        aria-hidden
        className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-brand-600 text-2xl shadow-lift"
      >
        🧾
      </div>
      <div className="min-w-0 flex-1">
        <h1 className="text-2xl font-extrabold tracking-tight text-stone-900">
          Split<span className="text-brand-600">Snap</span>
        </h1>
        <p className="truncate text-sm text-stone-500">Split the bill fairly.</p>
      </div>

      {/* Segmented currency control */}
      <div role="group" aria-label="Currency" className="flex rounded-2xl bg-stone-100 p-1">
        {CURRENCIES.map((c) => (
          <button
            key={c}
            type="button"
            aria-pressed={currency === c}
            onClick={() => onCurrency(c)}
            className={`min-h-11 rounded-xl px-2.5 text-xs font-bold transition ${
              currency === c ? "bg-white text-brand-700 shadow-sm" : "text-stone-500"
            }`}
          >
            {c}
          </button>
        ))}
      </div>
    </header>
  );
}
