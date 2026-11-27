"use client";

// "Scan receipt" button: opens the phone camera / file picker, compresses
// the photo to <1 MB in the browser, uploads it to /api/scan, and hands the
// parsed receipt back up via onScanned. Any failure shows a friendly error
// and the user can just keep entering items manually.
import { useRef, useState } from "react";
import { compressImageToBlob } from "@/lib/compressImage";
import type { ScannedReceipt } from "@/lib/scan";

type Props = {
  onScanned: (receipt: ScannedReceipt) => void;
};

export default function ScanButton({ onScanned }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
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
      onScanned(data.receipt as ScannedReceipt);
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
        className="w-full rounded-2xl bg-stone-800 px-4 py-4 text-lg font-bold text-white active:bg-stone-700 disabled:opacity-50"
      >
        {busy ? "Reading receipt…" : "📷 Scan receipt"}
      </button>
      {error && (
        <p className="mt-2 rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-red-700">
          {error}
        </p>
      )}
    </div>
  );
}
