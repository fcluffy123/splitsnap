"use client";

// Step 1: add the people splitting the bill (minimum 2).
import type { Person } from "@/lib/split";

// Fixed palette so chips always look distinct.
const PALETTE = [
  "#f43f5e", "#f97316", "#eab308", "#22c55e",
  "#14b8a6", "#3b82f6", "#8b5cf6", "#ec4899",
];

type Props = {
  people: Person[];
  onChange: (people: Person[]) => void;
};

export default function PeopleStep({ people, onChange }: Props) {
  const addPerson = (name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    const id = `p${Date.now()}${Math.floor(Math.random() * 1000)}`;
    const color = PALETTE[people.length % PALETTE.length];
    onChange([...people, { id, name: trimmed, color }]);
  };

  const removePerson = (id: string) => {
    onChange(people.filter((p) => p.id !== id));
  };

  return (
    <div className="space-y-4">
      <p className="text-stone-600">
        Who's splitting this bill? Add at least 2 people.
      </p>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          const input = e.currentTarget.elements.namedItem("name") as HTMLInputElement;
          addPerson(input.value);
          input.value = "";
        }}
        className="flex gap-2"
      >
        <input
          name="name"
          placeholder="Name (e.g. Lan)"
          className="flex-1 rounded-xl border border-stone-300 bg-white px-4 py-3 text-lg outline-none focus:border-amber-500"
        />
        <button
          type="submit"
          className="rounded-xl bg-amber-500 px-5 py-3 text-lg font-semibold text-white active:bg-amber-600"
        >
          Add
        </button>
      </form>

      <div className="flex flex-wrap gap-2">
        {people.map((p) => (
          <span
            key={p.id}
            className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-white text-base font-medium"
            style={{ backgroundColor: p.color }}
          >
            {p.name}
            <button
              onClick={() => removePerson(p.id)}
              aria-label={`Remove ${p.name}`}
              className="ml-1 flex h-6 w-6 items-center justify-center rounded-full bg-black/20 text-sm leading-none"
            >
              ×
            </button>
          </span>
        ))}
      </div>

      {people.length < 2 && (
        <p className="rounded-xl bg-amber-100 px-4 py-3 text-amber-800">
          Add {2 - people.length} more {people.length === 1 ? "person" : "people"} to continue.
        </p>
      )}
    </div>
  );
}
