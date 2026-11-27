"use client";

// "Scan receipt" button: opens the phone camera / file picker, compresses
// the photo to <1 MB in the browser, uploads it to /api/scan, and hands the
// parsed receipt back up via onScanned. Any failure shows a friendly error
// and the user can just keep entering items manually.
import { useRef, useState } from "react";
import { compressImageToBlob } from "@/lib/compressImage";
import type { ScannedReceipt } from "@/lib/scan";

type Props = {
  onScanned: (receipt: ScannedReceipt, startedBillVersion: number) => void;
  // Reads the bill's current version so the scan remembers which bill it
  // started on — a receipt delivered after a "New bill" reset is then
  // recognised as stale and ignored by the page.
  getBillVersion: () => number;
};

export default function ScanButton({ onScanned, getBillVersion }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    const startedBillVersion = getBillVersion(); // version at scan START
    setBusy(true);
    setError(null);
    try {
      const blob = await compressImageToBlob(file);
      const form = new FormData();
      form.append("image", blob, file.name.replace(/\.[^.]+$/, "") + ".jpg");

      const controller = new AbortController();
      // Generous timeout: Gemini can take a while on a big photo.
      const timer = setTimeout(() => controller.abort(), 120_000);
      let res;
      try {
        res = await fetch("/api/scan", { method: "POST", body: form, signal: controller.signal });
      } finally {
        clearTimeout(timer);
      }
      const data = await res.json().catch(() => null);

      if (!res.ok || !data?.ok) {
        setError(
          data?.error ||
            `The scan didn't work (server said ${res.status}). Try another photo, or enter items manually.`
        );
        return;
      }
      onScanned(data.receipt as ScannedReceipt, startedBillVersion);
    } catch (e) {
      setError(
        e instanceof DOMException && e.name === "AbortError"
          ? "The scan took too long and was cancelled. Try a clearer, smaller photo."
          : "Upload failed — check your connection and try again."
      );
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = ""; // allow re-picking the same file
    }
  };

  const pick = () => inputRef.current?.click();

  return (
    <div>
      {/* capture="environment" hints iOS Safari to open the rear camera directly */}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => handleFile(e.target.files?.[0])}
      />
      <button
        type="button"
        disabled={busy}
        aria-busy={busy}
        onClick={pick}
        className="group relative flex min-h-16 w-full items-center justify-center gap-3 overflow-hidden rounded-3xl bg-gradient-to-br from-brand-500 to-brand-700 px-5 text-lg font-bold text-white shadow-lift transition duration-200 hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98] disabled:cursor-wait"
      >
        {busy ? (
          <>
            <span aria-hidden className="h-5 w-5 rounded-full border-[3px] border-white/40 border-t-white motion-safe:animate-spin" />
            Reading receipt…
          </>
        ) : (
          <>
            <span aria-hidden className="text-2xl transition-transform duration-300 group-hover:rotate-[-8deg] group-hover:scale-110">
              📷
            </span>
            Scan a receipt
          </>
        )}
        {/* Soft shine sweeping across while busy */}
        {busy && (
          <span aria-hidden className="absolute inset-0 bg-gradient-to-r from-transparent via-white/15 to-transparent motion-safe:animate-pulse" />
        )}
      </button>

      <div aria-live="polite">
        {error && (
          <div className="motion-safe:animate-step-in mt-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-red-800">
            <p className="font-semibold">😕 Couldn't read that receipt</p>
            <p className="mt-1 text-sm">{error}</p>
            <button
              type="button"
              onClick={pick}
              className="mt-2 min-h-11 rounded-xl bg-white px-4 text-sm font-semibold text-red-700 ring-1 ring-red-200 active:bg-red-100"
            >
              Try another photo
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
