"use client";

// SplitSnap main screen — Phase 1 (manual splitter).
// A simple 4-step wizard: People → Items → Extras → Results.
// All state lives here and is mirrored to localStorage so a refresh
// doesn't lose the current bill.
import { useEffect, useState } from "react";
import PeopleStep from "@/components/PeopleStep";
import ItemsStep from "@/components/ItemsStep";
import ExtrasStep from "@/components/ExtrasStep";
import ResultsStep from "@/components/ResultsStep";
import type { Person, Item, Extras } from "@/lib/split";

const STEPS = ["People", "Items", "Extras", "Results"] as const;
const STORAGE_KEY = "splitsnap-bill-v1";

type ScanCheck = { scannedTotal: number; itemsTotal: number } | null;

const DEFAULT_EXTRAS: Extras = {
  taxPercent: 10,
  servicePercent: 0,
  tipPercent: 0,
  tipFixed: 0,
};

export default function Home() {
  const [step, setStep] = useState(0);
  const [people, setPeople] = useState<Person[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [extras, setExtras] = useState<Extras>(DEFAULT_EXTRAS);
  const [scanCheck, setScanCheck] = useState<ScanCheck>(null);
  const [hydrated, setHydrated] = useState(false); // false until localStorage is read

  // Load saved bill once, on mount (client only).
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const saved = JSON.parse(raw);
        if (Array.isArray(saved.people)) setPeople(saved.people);
        if (Array.isArray(saved.items)) setItems(saved.items);
        if (saved.extras) setExtras({ ...DEFAULT_EXTRAS, ...saved.extras });
        if (saved.scanCheck) setScanCheck(saved.scanCheck);
      }
    } catch {
      // Corrupt saved data — start fresh.
    }
    setHydrated(true);
  }, []);

  // Save on every change (after the initial load).
  useEffect(() => {
    if (!hydrated) return;
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ people, items, extras, scanCheck })
    );
  }, [people, items, extras, scanCheck, hydrated]);

  const canNext =
    (step === 0 && people.length >= 2) ||
    (step === 1 && items.length >= 1) ||
    step >= 2;

  if (!hydrated) return null; // avoid flashing empty state before localStorage loads

  return (
    <main className="mx-auto max-w-md px-4 py-6 pb-28">
      <header className="mb-6 text-center">
        <h1 className="text-3xl font-extrabold tracking-tight">SplitSnap</h1>
        <p className="text-stone-500">Split the bill fairly, in seconds.</p>
      </header>

      {/* Step indicator */}
      <ol className="mb-6 flex justify-between gap-1">
        {STEPS.map((label, i) => (
          <li key={label} className="flex-1 text-center">
            <button
              onClick={() => setStep(i)}
              className={`w-full rounded-full px-2 py-2 text-sm font-semibold ${
                i === step
                  ? "bg-amber-500 text-white"
                  : i < step
                    ? "bg-amber-100 text-amber-800"
                    : "bg-stone-100 text-stone-400"
              }`}
            >
              {i + 1}. {label}
            </button>
          </li>
        ))}
      </ol>

      {step === 0 && <PeopleStep people={people} onChange={setPeople} />}
      {step === 1 && (
        <ItemsStep
          people={people}
          items={items}
          onChange={setItems}
          scanCheck={scanCheck}
          onScanCheck={setScanCheck}
        />
      )}
      {step === 2 && <ExtrasStep extras={extras} onChange={setExtras} />}
      {step === 3 && (
        <ResultsStep people={people} items={items} extras={extras} currency="VND" />
      )}

      {/* Bottom navigation — big tap targets for mobile */}
      <nav className="fixed bottom-0 left-0 right-0 border-t border-stone-200 bg-amber-50/95 backdrop-blur">
        <div className="mx-auto flex max-w-md gap-3 px-4 py-3">
          <button
            onClick={() => setStep((s) => Math.max(0, s - 1))}
            disabled={step === 0}
            className="flex-1 rounded-2xl bg-stone-200 px-4 py-4 text-lg font-semibold disabled:opacity-40"
          >
            ← Back
          </button>
          <button
            onClick={() => setStep((s) => Math.min(STEPS.length - 1, s + 1))}
            disabled={!canNext}
            className="flex-[2] rounded-2xl bg-amber-500 px-4 py-4 text-lg font-bold text-white active:bg-amber-600 disabled:opacity-40"
          >
            {step === STEPS.length - 1 ? "Done ✓" : "Next →"}
          </button>
        </div>
      </nav>
    </main>
  );
}
