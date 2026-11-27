"use client";

// Step 1: add the people splitting the bill (minimum 2).
import type { Person } from "@/lib/split";
import EmptyState from "./EmptyState";
import { initial, input, primaryBtn, textOn } from "./ui";

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
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const field = e.currentTarget.elements.namedItem("name") as HTMLInputElement;
          addPerson(field.value);
          field.value = "";
          field.focus(); // keep the keyboard open for the next name
        }}
        className="flex gap-2"
      >
        <label htmlFor="person-name" className="sr-only">Person's name</label>
        <input
          id="person-name"
          name="name"
          placeholder="Name (e.g. Lan)"
          autoComplete="off"
          enterKeyHint="done"
          className={`${input} flex-1`}
        />
        <button type="submit" className={`${primaryBtn} text-lg`}>
          Add
        </button>
      </form>

      {people.length === 0 ? (
        <EmptyState icon="👋" title="Nobody here yet">
          Add everyone at the table — you can remove names any time.
        </EmptyState>
      ) : (
        <ul className="flex flex-wrap gap-2" aria-label="People">
          {people.map((p) => (
            <li
              key={p.id}
              className="motion-safe:animate-row-in inline-flex min-h-11 items-center gap-2 rounded-full bg-white py-1 pl-1 pr-1 shadow-card"
            >
              <span
                aria-hidden
                className="flex h-9 w-9 items-center justify-center rounded-full font-bold"
                style={{ backgroundColor: p.color, color: textOn(p.color) }}
              >
                {initial(p.name)}
              </span>
              <span className="font-semibold">{p.name}</span>
              <button
                type="button"
                onClick={() => removePerson(p.id)}
                aria-label={`Remove ${p.name}`}
                className="flex h-11 w-11 items-center justify-center rounded-full text-stone-400 transition hover:bg-stone-100 hover:text-stone-700"
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
