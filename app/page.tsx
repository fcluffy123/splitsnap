"use client";

// SplitSnap main screen — 3-step wizard: Scan → Assign → Results.
// All state lives here and is mirrored to localStorage so a refresh
// doesn't lose the current bill.
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

const STEPS = ["Scan", "Assign", "Results"] as const;
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
    (step === 0 && items.length >= 1) ||
    (step === 1 && people.length >= 2) ||
    step >= 2;
  const nextHint =
    step === 0 && items.length === 0
      ? "Add at least one item to continue"
      : step === 1 && people.length < 2
        ? "Add at least 2 people to continue"
        : null;

  const summaryText = () =>
    buildSummaryText(splitBill(people, items, extras, smallestUnit(currency)), currency);

  const canShare = typeof navigator !== "undefined" && typeof navigator.share === "function";

  const shareSummary = async () => {
    try {
      await navigator.share({ title: "SplitSnap", text: summaryText() });
    } catch {
      // User cancelled the share sheet — nothing to do.
    }
  };

  const copySummary = async () => {
    const text = summaryText();
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

  // Receives a scanned receipt. The version recorded when the scan STARTED
  // is compared against the bill's current version; if the bill was reset
  // (or another, newer scan has taken over) the stale receipt is dropped
  // entirely — it must not clear a newer receipt's saved total check.
  const handleScanned = (receipt: ScannedReceipt, startedVersion: number) => {
    if (billVersionRef.current !== startedVersion) return; // bill changed since the scan started
    const scanned: Item[] = receipt.items.map((it, i) => ({
      id: `s${Date.now()}${i}`,
      name: it.name,
      price: it.price,
      qty: it.qty,
      assignedTo: [],
    }));
    setItems((prev) => [...prev, ...scanned]);
    const itemsTotal = receipt.items.reduce((s, it) => s + it.price * it.qty, 0);
    setScanCheck({ scannedTotal: receipt.total, itemsTotal });
  };

  if (!hydrated) return null; // avoid flashing empty state before localStorage loads

  const btn =
    "min-h-11 rounded-2xl px-4 py-3 font-semibold transition duration-150 active:scale-[0.98] disabled:opacity-40 disabled:active:scale-100";

  return (
    <main className="mx-auto max-w-md px-4 pt-6 pb-36">
      <header className="mb-5 flex items-center gap-3">
        <div
          aria-hidden="true"
          className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-400 text-2xl shadow-md shadow-amber-200"
        >
          🧾
        </div>
        <div className="flex-1">
          <h1 className="text-2xl font-extrabold tracking-tight">SplitSnap</h1>
          <p className="text-sm text-stone-500">Snap, tap, done — split the bill fairly.</p>
        </div>
        <label className="sr-only" htmlFor="currency">Currency</label>
        <select
          id="currency"
          value={currency}
          onChange={(e) => setCurrency(e.target.value as Currency)}
          className="min-h-11 rounded-xl border border-stone-200 bg-white px-3 text-sm font-bold shadow-sm"
        >
          {CURRENCIES.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
      </header>

      {/* Step indicator */}
      <nav aria-label="Progress" className="mb-6">
        <ol className="flex items-center gap-2">
          {STEPS.map((label, i) => (
            <li key={label} className="flex flex-1 items-center gap-2">
              <button
                onClick={() => setStep(i)}
                aria-current={i === step ? "step" : undefined}
                className={`flex min-h-11 w-full items-center justify-center gap-2 rounded-full px-3 text-sm font-semibold transition-colors duration-200 ${
                  i === step
                    ? "bg-amber-500 text-white shadow-md shadow-amber-200"
                    : i < step
                      ? "bg-amber-100 text-amber-800"
                      : "bg-white text-stone-400 ring-1 ring-stone-200"
                }`}
              >
                <span
                  aria-hidden="true"
                  className={`flex h-6 w-6 items-center justify-center rounded-full text-xs ${
                    i === step ? "bg-white/25" : i < step ? "bg-amber-200" : "bg-stone-100"
                  }`}
                >
                  {i < step ? "✓" : i + 1}
                </span>
                {label}
              </button>
            </li>
          ))}
        </ol>
      </nav>

      <section key={step} className="animate-step">
        {step === 0 && (
          <ItemsStep
            mode="scan"
            people={people}
            items={items}
            currency={currency}
            onChange={setItems}
            onScanned={handleScanned}
            getBillVersion={() => billVersionRef.current}
            scanCheck={scanCheck}
            onScanCheck={setScanCheck}
          />
        )}
        {step === 1 && (
          <div className="space-y-6">
            <PeopleStep people={people} onChange={setPeople} />
            {people.length > 0 && (
              <ItemsStep
                mode="assign"
                people={people}
                items={items}
                currency={currency}
                onChange={setItems}
                onScanned={handleScanned}
                getBillVersion={() => billVersionRef.current}
                scanCheck={scanCheck}
                onScanCheck={setScanCheck}
              />
            )}
            <ExtrasStep extras={extras} currency={currency} onChange={setExtras} />
          </div>
        )}
        {step === 2 && (
          <>
            <ResultsStep people={people} items={items} extras={extras} currency={currency} />

            <div className="mt-5 space-y-3">
              <div className="flex gap-2">
                <button
                  onClick={copySummary}
                  className={`${btn} flex-1 bg-stone-800 text-white shadow-md shadow-stone-300 hover:bg-stone-700`}
                >
                  {copied ? "✓ Copied!" : "📋 Copy summary"}
                </button>
                {canShare && (
                  <button
                    onClick={shareSummary}
                    className={`${btn} bg-white text-stone-800 shadow-sm ring-1 ring-stone-200 hover:bg-stone-50`}
                  >
                    ↗ Share
                  </button>
                )}
              </div>
              <p role="status" className="min-h-5 text-center text-sm text-stone-500">
                {copied ? "Paste it in Zalo or Messenger." : ""}
              </p>

              {confirmingNewBill ? (
                <div role="alertdialog" aria-labelledby="new-bill-q" className="rounded-3xl border border-red-200 bg-red-50 p-4">
                  <p id="new-bill-q" className="mb-3 font-semibold text-red-700">
                    Start a new bill? The current one will be cleared.
                  </p>
                  <div className="flex gap-2">
                    <button onClick={newBill} className={`${btn} flex-1 bg-red-600 text-white hover:bg-red-700`}>
                      Yes, clear it
                    </button>
                    <button
                      onClick={() => setConfirmingNewBill(false)}
                      className={`${btn} flex-1 bg-white text-stone-600 ring-1 ring-stone-300`}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setConfirmingNewBill(true)}
                  className={`${btn} w-full bg-transparent text-stone-500 hover:bg-stone-100`}
                >
                  Start a new bill
                </button>
              )}
            </div>
          </>
        )}
      </section>

      {/* Bottom navigation — big tap targets for mobile */}
      <nav aria-label="Step navigation" className="fixed bottom-0 left-0 right-0 border-t border-stone-200/70 bg-white/85 backdrop-blur">
        <div className="mx-auto max-w-md px-4 pt-2 pb-3">
          {nextHint && <p className="mb-2 text-center text-xs text-stone-500">{nextHint}</p>}
          <div className="flex gap-3">
            <button
              onClick={() => setStep((s) => Math.max(0, s - 1))}
              disabled={step === 0}
              className={`${btn} flex-1 bg-stone-100 text-lg text-stone-700 hover:bg-stone-200`}
            >
              ← Back
            </button>
            {step < STEPS.length - 1 && (
              <button
                onClick={() => setStep((s) => Math.min(STEPS.length - 1, s + 1))}
                disabled={!canNext}
                className={`${btn} flex-[2] bg-amber-500 text-lg font-bold text-white shadow-md shadow-amber-200 hover:bg-amber-600`}
              >
                {step === 0 ? "Assign →" : "See results →"}
              </button>
            )}
          </div>
        </div>
      </nav>
    </main>
  );
}
