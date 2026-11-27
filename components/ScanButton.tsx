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
        onClick={() => inputRef.current?.click()}
        aria-busy={busy}
        className="flex min-h-14 w-full items-center justify-center gap-2 rounded-3xl bg-gradient-to-br from-amber-400 to-orange-500 px-4 py-4 text-lg font-bold text-white shadow-lg shadow-orange-200 transition duration-150 hover:brightness-105 active:scale-[0.98] disabled:opacity-60"
      >
        {busy ? (
          <>
            <span aria-hidden="true" className="h-5 w-5 animate-spin rounded-full border-2 border-white/40 border-t-white" />
            Reading receipt…
          </>
        ) : (
          <>📷 Scan receipt</>
        )}
      </button>
      {error && (
        <div role="alert" className="mt-3 rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-700 ring-1 ring-rose-200">
          <p className="font-semibold">Hmm, that scan didn't work.</p>
          <p>{error}</p>
        </div>
      )}
    </div>
  );
}
