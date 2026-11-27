"use client";

// SplitSnap main screen — 4-step wizard: People → Items → Extras → Results.
// All state lives here and is mirrored to localStorage so a refresh
// doesn't lose the current bill. Phase 3 adds a currency selector,
// a copy-summary button and a new-bill button.
import { useEffect, useRef, useState } from "react";
import PeopleStep from "@/components/PeopleStep";
import ItemsStep from "@/components/ItemsStep";
import ExtrasStep from "@/components/ExtrasStep";
import ResultsStep from "@/components/ResultsStep";
import {
  buildSummaryText,
  splitBill,
  smallestUnit,
  CURRENCIES,
  type Currency,
  type Person,
  type Item,
  type Extras,
} from "@/lib/split";
import type { ScannedReceipt } from "@/lib/scan";

const STEPS = ["People", "Items", "Extras", "Results"] as const;
const STORAGE_KEY = "splitsnap-bill-v1";

const DEFAULT_EXTRAS: Extras = {
  taxPercent: 10,
  servicePercent: 0,
  tipPercent: 0,
  tipFixed: 0,
};

type ScanCheck = { scannedTotal: number; itemsTotal: number } | null;

export default function Home() {
  const [step, setStep] = useState(0);
  const [people, setPeople] = useState<Person[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [extras, setExtras] = useState<Extras>(DEFAULT_EXTRAS);
  const [currency, setCurrency] = useState<Currency>("VND");
  const [scanCheck, setScanCheck] = useState<ScanCheck>(null);
  const [hydrated, setHydrated] = useState(false); // false until localStorage is read
  const [copied, setCopied] = useState(false);
  const [confirmingNewBill, setConfirmingNewBill] = useState(false);
  // Increments on every "New bill" reset, so a scan that was still running
  // when the bill was cleared can be detected and dropped.
  const billVersionRef = useRef(0);

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
        if (saved.currency) setCurrency(saved.currency);
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
      JSON.stringify({ people, items, extras, scanCheck, currency })
    );
  }, [people, items, extras, scanCheck, currency, hydrated]);

  const canNext =
    (step === 0 && people.length >= 2) ||
    (step === 1 && items.length >= 1) ||
    step >= 2;

  const copySummary = async () => {
    const result = splitBill(people, items, extras, smallestUnit(currency));
    const text = buildSummaryText(result, currency);
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard blocked (e.g. non-HTTPS) — fall back to a selectable textarea prompt
      window.prompt("Copy your summary:", text);
    }
  };

  const newBill = () => {
    // Bump the version first so any scan still in flight is dropped.
    billVersionRef.current += 1;
    // Clears everything (state + localStorage) and returns to step 1.
    setPeople([]);
    setItems([]);
    setExtras(DEFAULT_EXTRAS);
    setScanCheck(null);
    setCurrency("VND");
    setStep(0);
    setConfirmingNewBill(false);
    localStorage.removeItem(STORAGE_KEY);
  };

  // Receives a scanned receipt. Uses functional updates + the bill version so
  // a scan that finishes AFTER "New bill" was pressed is ignored — otherwise
  // the old receipt's items would be written into the freshly cleared bill.
  const handleScanned = (receipt: ScannedReceipt) => {
    const version = billVersionRef.current;
    setItems((prev) => {
      if (billVersionRef.current !== version) return prev; // bill was reset meanwhile
      const scanned: Item[] = receipt.items.map((it, i) => ({
        id: `s${Date.now()}${i}`,
        name: it.name,
        price: it.price,
        qty: it.qty,
        assignedTo: [],
      }));
      return [...prev, ...scanned];
    });
    setScanCheck(() => {
      if (billVersionRef.current !== version) return null; // bill was reset meanwhile
      const itemsTotal = receipt.items.reduce((s, it) => s + it.price * it.qty, 0);
      return { scannedTotal: receipt.total, itemsTotal };
    });
  };

  if (!hydrated) return null; // avoid flashing empty state before localStorage loads

  return (
    <main className="mx-auto max-w-md px-4 py-6 pb-32">
      <header className="mb-4 text-center">
        <h1 className="text-3xl font-extrabold tracking-tight">SplitSnap</h1>
        <p className="text-stone-500">Split the bill fairly, in seconds.</p>
      </header>

      {/* Currency selector */}
      <div className="mb-4 flex items-center justify-center gap-2">
        <span className="text-sm text-stone-500">Currency:</span>
        {CURRENCIES.map((c) => (
          <button
            key={c}
            onClick={() => setCurrency(c)}
            className={`rounded-full px-4 py-2 text-sm font-bold ${
              currency === c
                ? "bg-stone-800 text-white"
                : "bg-stone-100 text-stone-500"
            }`}
          >
            {c}
          </button>
        ))}
      </div>

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
          onScanned={handleScanned}
          scanCheck={scanCheck}
          onScanCheck={setScanCheck}
        />
      )}
      {step === 2 && <ExtrasStep extras={extras} currency={currency} onChange={setExtras} />}
      {step === 3 && (
        <>
          <ResultsStep people={people} items={items} extras={extras} currency={currency} />

          {/* Phase 3 actions */}
          <div className="mt-4 space-y-3">
            <button
              onClick={copySummary}
              className="w-full rounded-2xl bg-stone-800 px-4 py-4 text-lg font-bold text-white active:bg-stone-700"
            >
              {copied ? "✓ Copied! Paste it in Zalo/Messenger" : "📋 Copy summary"}
            </button>

            {confirmingNewBill ? (
              <div className="rounded-2xl border border-red-200 bg-red-50 p-4">
                <p className="mb-3 font-semibold text-red-700">
                  Start a new bill? The current one will be cleared.
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={newBill}
                    className="flex-1 rounded-xl bg-red-600 px-4 py-3 font-bold text-white active:bg-red-700"
                  >
                    Yes, clear it
                  </button>
                  <button
                    onClick={() => setConfirmingNewBill(false)}
                    className="flex-1 rounded-xl bg-white px-4 py-3 font-semibold text-stone-600 border border-stone-300"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setConfirmingNewBill(true)}
                className="w-full rounded-2xl bg-stone-200 px-4 py-4 text-lg font-semibold text-stone-700 active:bg-stone-300"
              >
                🗑 New bill
              </button>
            )}
          </div>
        </>
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
