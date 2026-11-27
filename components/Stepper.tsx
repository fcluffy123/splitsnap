"use client";

// Step indicator: numbered dots joined by a progress bar. Tapping a dot
// jumps to that step. The current step is announced via aria-current.
type Props = {
  steps: readonly { label: string; icon: string }[];
  current: number;
  onSelect: (i: number) => void;
};

export default function Stepper({ steps, current, onSelect }: Props) {
  const progress = (current / (steps.length - 1)) * 100;
  return (
    <nav aria-label="Progress" className="relative mb-6">
      {/* Track + fill, sitting behind the dots */}
      <div className="absolute left-[12.5%] right-[12.5%] top-[22px] h-1 rounded-full bg-stone-200">
        <div
          className="h-full rounded-full bg-brand-500 transition-[width] duration-500 ease-out"
          style={{ width: `${progress}%` }}
        />
      </div>
      <ol className="relative grid grid-cols-4">
        {steps.map((s, i) => {
          const state = i === current ? "current" : i < current ? "done" : "todo";
          return (
            <li key={s.label} className="flex justify-center">
              <button
                type="button"
                onClick={() => onSelect(i)}
                aria-current={state === "current" ? "step" : undefined}
                className="group flex min-h-11 flex-col items-center gap-1 rounded-2xl px-1"
              >
                <span
                  className={`flex h-11 w-11 items-center justify-center rounded-full text-lg transition duration-300 ${
                    state === "current"
                      ? "scale-110 bg-brand-600 text-white shadow-lift"
                      : state === "done"
                        ? "bg-brand-100 text-brand-700"
                        : "border border-stone-200 bg-white text-stone-400"
                  }`}
                >
                  <span aria-hidden>{state === "done" ? "✓" : s.icon}</span>
                </span>
                <span
                  className={`text-xs font-semibold ${
                    state === "current" ? "text-brand-700" : "text-stone-500"
                  }`}
                >
                  <span className="sr-only">Step {i + 1}: </span>
                  {s.label}
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
