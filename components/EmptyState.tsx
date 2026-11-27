// Friendly placeholder for "nothing here yet" and recoverable problems.
type Props = {
  icon: string;
  title: string;
  children?: React.ReactNode; // hint text and/or an action button
  tone?: "neutral" | "warn";
};

export default function EmptyState({ icon, title, children, tone = "neutral" }: Props) {
  const colors =
    tone === "warn"
      ? "border-accent-400/60 bg-accent-100/60 text-amber-900"
      : "border-stone-300 bg-white/60 text-stone-600";
  return (
    <div className={`motion-safe:animate-step-in rounded-3xl border-2 border-dashed px-5 py-6 text-center ${colors}`}>
      <div aria-hidden className="mb-2 text-4xl">{icon}</div>
      <p className="font-bold text-stone-800">{title}</p>
      {children && <div className="mt-1 text-sm">{children}</div>}
    </div>
  );
}
