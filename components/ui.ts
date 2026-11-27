// Small shared UI helpers (no React) so components stay consistent.

// Black or white text, whichever reads better on the given hex background.
// Keeps yellow/amber chips legible while blue/violet ones stay white.
export function textOn(hex: string): string {
  const n = parseInt(hex.replace("#", ""), 16);
  if (Number.isNaN(n)) return "#fff";
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  // Perceived brightness (YIQ); above ~150 is a light color.
  return (r * 299 + g * 587 + b * 114) / 1000 > 150 ? "#1c1917" : "#fff";
}

// First letter of a name for avatars ("lan" -> "L").
export function initial(name: string): string {
  return (name.trim()[0] ?? "?").toUpperCase();
}

// Shared class strings. Every interactive control is at least 44px tall.
export const card = "rounded-3xl border border-stone-200/70 bg-white p-4 shadow-card";
export const input =
  "min-h-12 w-full rounded-2xl border border-stone-300 bg-white px-4 text-lg outline-none transition focus:border-brand-500 focus:ring-4 focus:ring-brand-100";
export const primaryBtn =
  "min-h-12 rounded-2xl bg-brand-600 px-5 font-bold text-white shadow-lift transition active:scale-[0.98] active:bg-brand-700 disabled:opacity-40 disabled:shadow-none disabled:active:scale-100";
export const secondaryBtn =
  "min-h-12 rounded-2xl bg-stone-100 px-5 font-semibold text-stone-700 transition active:scale-[0.98] active:bg-stone-200 disabled:opacity-40 disabled:active:scale-100";
