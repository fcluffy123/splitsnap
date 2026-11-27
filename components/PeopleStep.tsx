"use client";

// Add the people splitting the bill (minimum 2). Shown on the Assign step.
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
    <div className="space-y-3 rounded-3xl bg-white p-4 shadow-sm ring-1 ring-stone-100">
      <div>
        <h2 className="text-lg font-bold">Who's at the table?</h2>
        <p className="text-sm text-stone-500">Add at least 2 people.</p>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          const input = e.currentTarget.elements.namedItem("name") as HTMLInputElement;
          addPerson(input.value);
          input.value = "";
        }}
        className="flex gap-2"
      >
        <label htmlFor="person-name" className="sr-only">Person's name</label>
        <input
          id="person-name"
          name="name"
          placeholder="Name (e.g. Lan)"
          autoComplete="off"
          className="min-h-11 flex-1 rounded-xl border border-stone-200 bg-stone-50 px-4 py-2 text-lg transition-colors focus:border-amber-400 focus:bg-white"
        />
        <button
          type="submit"
          className="min-h-11 rounded-xl bg-amber-500 px-5 font-semibold text-white transition active:scale-[0.97] hover:bg-amber-600"
        >
          Add
        </button>
      </form>

      {people.length > 0 && (
        <ul className="flex flex-wrap gap-2" aria-label="People">
          {people.map((p) => (
            <li
              key={p.id}
              className="inline-flex items-center gap-1 rounded-full py-1 pr-1 pl-4 text-base font-medium text-white shadow-sm"
              style={{ backgroundColor: p.color }}
            >
              {p.name}
              <button
                onClick={() => removePerson(p.id)}
                aria-label={`Remove ${p.name}`}
                className="flex h-11 w-11 items-center justify-center rounded-full text-lg leading-none transition-colors hover:bg-black/15"
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}

      {people.length < 2 && (
        <p className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800">
          👋 Add {2 - people.length} more {people.length === 1 ? "person" : "people"} to split the bill.
        </p>
      )}
    </div>
  );
}
