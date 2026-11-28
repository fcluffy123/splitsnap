"use client";

// SplitSnap main screen — 4-step wizard: People → Items → Extras → Results.
// All state lives here and is mirrored to localStorage so a refresh
// doesn't lose the current bill. Phase 3 adds a currency selector,
// a copy-summary button and a new-bill button.
import { useEffect, useRef, useState } from "react";
import Header from "@/components/Header";
import Stepper from "@/components/Stepper";
import SummaryActions from "@/components/SummaryActions";
import { primaryBtn, secondaryBtn } from "@/components/ui";
import PeopleStep from "@/components/PeopleStep";
import ItemsStep from "@/components/ItemsStep";
import ExtrasStep from "@/components/ExtrasStep";
import ResultsStep from "@/components/ResultsStep";
import {
  buildSummaryText,
  splitBill,
  smallestUnit,
  type Currency,
  type Person,
  type Item,
  type Extras,
} from "@/lib/split";
import type { ScannedReceipt } from "@/lib/scan";

// Label/icon for the stepper, plus the heading and hint shown above each step.
const STEPS = [
  { label: "People", icon: "👥", title: "Who's eating?", hint: "Add at least 2 people." },
  { label: "Items", icon: "📷", title: "What did you order?", hint: "Scan or add items, then tap who had each one." },
  { label: "Extras", icon: "➕", title: "Tax, service & tip", hint: "Split in proportion to what each person ordered — not evenly." },
  { label: "Results", icon: "✨", title: "Who owes what", hint: "Copy the summary and paste it in your group chat." },
] as const;
const STORAGE_KEY = "splitsnap-bill-v1";

const DEFAULT_EXTRAS: Extras = {
  taxPercent: 0,
  servicePercent: 0,
  tipPercent: 0,
  tipFixed: 0,
  discountType: "fixed",
  discountValue: 0,
  pricesIncludeTax: false,
};

type ScanCheck = { scannedTotal: number; computedTotal: number } | null;

const round2 = (n: number) => Math.round(n * 100) / 100;

export default function Home() {
  const [step, setStep] = useState(0);
  const [people, setPeople] = useState<Person[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [extras, setExtras] = useState<Extras>(DEFAULT_EXTRAS);
  const [currency, setCurrency] = useState<Currency>("VND");
  const [scanCheck, setScanCheck] = useState<ScanCheck>(null);
  const [hydrated, setHydrated] = useState(false); // false until localStorage is read
  const [copied, setCopied] = useState(false);
  const [canShare, setCanShare] = useState(false); // Web Share API available?
  const headingRef = useRef<HTMLHeadingElement>(null);
  const stepChangedRef = useRef(false); // skip focusing the heading on first load
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
        // Only restore a scan check in the current shape (computedTotal).
        if (
          saved.scanCheck &&
          typeof saved.scanCheck.scannedTotal === "number" &&
          typeof saved.scanCheck.computedTotal === "number"
        ) {
          setScanCheck(saved.scanCheck);
        }
        if (saved.currency) setCurrency(saved.currency);
      }
    } catch {
      // Corrupt saved data — start fresh.
    }
    setCanShare(typeof navigator.share === "function");
    setHydrated(true);
  }, []);

  // On step change: scroll to the top and move focus to the new step's
  // heading, so keyboard and screen-reader users land in the right place.
  useEffect(() => {
    if (!stepChangedRef.current) return;
    window.scrollTo({ top: 0 });
    headingRef.current?.focus({ preventScroll: true });
  }, [step]);

  const goTo = (i: number) => {
    stepChangedRef.current = true;
    setStep(Math.max(0, Math.min(STEPS.length - 1, i)));
  };

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

  const summaryText = () =>
    buildSummaryText(splitBill(people, items, extras, smallestUnit(currency)), currency);

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

  // Native share sheet (mobile). Falls back to copying if sharing fails;
  // a user closing the sheet (AbortError) is not a failure.
  const shareSummary = async () => {
    try {
      await navigator.share({ title: "SplitSnap", text: summaryText() });
    } catch (e) {
      if (!(e instanceof DOMException && e.name === "AbortError")) copySummary();
    }
  };

  // Removing a person also unassigns them, so their items get flagged
  // instead of silently landing on someone else.
  const updatePeople = (next: Person[]) => {
    setPeople(next);
    const ids = new Set(next.map((p) => p.id));
    setItems((prev) =>
      prev.map((it) => ({ ...it, assignedTo: it.assignedTo.filter((id) => ids.has(id)) }))
    );
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
    goTo(0);
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

    // Prefill Extras from the receipt: tax/service become percentages of the
    // scanned subtotal (2 decimals); no tax printed means 0%. A discount
    // becomes a fixed discount in Extras.
    const itemsTotal = receipt.items.reduce((s, it) => s + it.price * it.qty, 0);
    const subtotal = receipt.subtotal > 0 ? receipt.subtotal : itemsTotal;
    const taxPercent = receipt.tax > 0 ? round2((receipt.tax / subtotal) * 100) : 0;
    const servicePercent =
      receipt.service > 0 ? round2((receipt.service / subtotal) * 100) : 0;
    const discount = receipt.discount > 0 ? receipt.discount : 0;
    const merged: Extras = {
      ...extras,
      // "Total (+VAT)" receipts: tax is already inside the prices, so tax 0%
      // and remember that the prices include tax.
      taxPercent: receipt.taxIncluded ? 0 : taxPercent,
      pricesIncludeTax: receipt.taxIncluded || extras.pricesIncludeTax,
      servicePercent,
      discountType: "fixed",
      discountValue: discount,
    };
    setExtras(merged);

    // Total check: the scanned total should match the computed GRAND total
    // (items minus discount plus tax, service and tip) — not the raw items sum.
    const disc = Math.min(
      Math.max(0, merged.discountValue),
      itemsTotal
    );
    const base = itemsTotal - disc;
    const tip =
      merged.tipFixed > 0 ? merged.tipFixed : (base * merged.tipPercent) / 100;
    const computedTotal =
      base + (base * merged.taxPercent) / 100 + (base * merged.servicePercent) / 100 + tip;
    setScanCheck({ scannedTotal: receipt.total, computedTotal });
  };

  if (!hydrated) return null; // avoid flashing empty state before localStorage loads

  const current = STEPS[step];
  const isLast = step === STEPS.length - 1;
  // Why "Next" is disabled, shown just above the bottom bar.
  const blockedHint =
    step === 0 && people.length < 2
      ? `Add ${2 - people.length} more ${people.length === 1 ? "person" : "people"} to continue`
      : step === 1 && items.length === 0
        ? "Add at least 1 item to continue"
        : null;
  const barHint = isLast && copied ? "Copied! Paste it in Zalo or Messenger 💬" : blockedHint;

  return (
    <main className="mx-auto max-w-md px-4 pt-5 pb-44">
      <Header currency={currency} onCurrency={setCurrency} />
      <Stepper steps={STEPS} current={step} onSelect={goTo} />

      {/* key={step} remounts this block so every step fades/slides in */}
      <section key={step} className="motion-safe:animate-step-in" aria-labelledby="step-title">
        <div className="mb-4">
          <h2 id="step-title" ref={headingRef} tabIndex={-1} className="text-2xl font-extrabold tracking-tight outline-none">
            {current.title}
          </h2>
          <p className="text-stone-500">{current.hint}</p>
        </div>

        {step === 0 && <PeopleStep people={people} onChange={updatePeople} />}
        {step === 1 && (
          <ItemsStep
            people={people}
            items={items}
            onChange={setItems}
            onScanned={handleScanned}
            getBillVersion={() => billVersionRef.current}
            scanCheck={scanCheck}
            onScanCheck={setScanCheck}
          />
        )}
        {step === 2 && <ExtrasStep extras={extras} currency={currency} onChange={setExtras} />}
        {step === 3 && (
          <>
            <ResultsStep people={people} items={items} extras={extras} currency={currency} onGoTo={goTo} />
            <SummaryActions canShare={canShare && people.length > 0 && items.length > 0} onShare={shareSummary} onNewBill={newBill} />
          </>
        )}
      </section>

      {/* Bottom bar — big tap targets, padded for the iPhone home indicator */}
      <nav
        aria-label="Steps"
        className="fixed inset-x-0 bottom-0 border-t border-stone-200/80 bg-white/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-md"
      >
        <div className="mx-auto max-w-md px-4 pt-2 pb-3">
          <p aria-live="polite" className="min-h-5 pb-2 text-center text-sm font-medium text-stone-500">
            {barHint}
          </p>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => goTo(step - 1)}
              disabled={step === 0}
              className={`${secondaryBtn} min-h-14 flex-1 text-lg`}
            >
              ← Back
            </button>
            {isLast ? (
              <button
                type="button"
                onClick={copySummary}
                disabled={people.length === 0 || items.length === 0}
                className={`${primaryBtn} min-h-14 flex-[2] text-lg ${copied ? "motion-safe:animate-pop bg-emerald-600 active:bg-emerald-700" : ""}`}
              >
                {copied ? "✓ Copied!" : "📋 Copy summary"}
              </button>
            ) : (
              <button
                type="button"
                onClick={() => goTo(step + 1)}
                disabled={!canNext}
                className={`${primaryBtn} min-h-14 flex-[2] text-lg`}
              >
                Next: {STEPS[step + 1].label} →
              </button>
            )}
          </div>
        </div>
      </nav>
    </main>
  );
}
