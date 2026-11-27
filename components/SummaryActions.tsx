"use client";

// Results-screen actions: share (when the phone supports it) and
// "New bill" with an inline confirm so a stray tap can't wipe the bill.
// The big "Copy summary" button lives in the bottom bar (see page.tsx).
import { useState } from "react";
import { secondaryBtn } from "./ui";

type Props = {
  canShare: boolean;
  onShare: () => void;
  onNewBill: () => void;
};

export default function SummaryActions({ canShare, onShare, onNewBill }: Props) {
  const [confirming, setConfirming] = useState(false);

  return (
    <div className="mt-4 space-y-3">
      {canShare && (
        <button type="button" onClick={onShare} className={`${secondaryBtn} w-full bg-brand-50 text-lg text-brand-700 active:bg-brand-100`}>
          📤 Share summary…
        </button>
      )}

      {confirming ? (
        <div role="alertdialog" aria-label="Start a new bill?" className="motion-safe:animate-step-in rounded-3xl border border-red-200 bg-red-50 p-4">
          <p className="mb-3 font-semibold text-red-800">
            Start a new bill? The current one will be cleared.
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onNewBill}
              className="min-h-12 flex-1 rounded-2xl bg-red-600 px-4 font-bold text-white active:bg-red-700"
            >
              Yes, clear it
            </button>
            {/* Focus lands on Cancel, so a held/repeated key can't confirm */}
            <button type="button" autoFocus onClick={() => setConfirming(false)} className={`${secondaryBtn} flex-1 bg-white ring-1 ring-stone-200`}>
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <button type="button" onClick={() => setConfirming(true)} className={`${secondaryBtn} w-full`}>
          🗑 New bill
        </button>
      )}
    </div>
  );
}
