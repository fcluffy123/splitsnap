// Unit tests for the money math. Run with: npm test
// (node --test runs the TypeScript test file directly on modern Node.)
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  splitBill,
  formatMoney,
  buildSummaryText,
  smallestUnit,
  type Person,
  type Item,
} from "./split.ts";

const lan: Person = { id: "p1", name: "Lan", color: "#f43f5e" };
const minh: Person = { id: "p2", name: "Minh", color: "#3b82f6" };

const noExtras = { taxPercent: 0, servicePercent: 0, tipPercent: 0, tipFixed: 0 };

function item(id: string, name: string, price: number, qty: number, assignedTo: string[]): Item {
  return { id, name, price, qty, assignedTo };
}

test("single shared item splits evenly", () => {
  const items = [item("i1", "Pho", 100000, 1, ["p1", "p2"])];
  const r = splitBill([lan, minh], items, noExtras);
  assert.equal(r.people[0].total, 50000);
  assert.equal(r.people[1].total, 50000);
  assert.equal(r.grandTotal, 100000);
});

test("quantity multiplies the line total", () => {
  const items = [item("i1", "Beer", 50000, 3, ["p1"])];
  const r = splitBill([lan, minh], items, noExtras);
  assert.equal(r.people[0].total, 150000);
  assert.equal(r.people[1].total, 0);
});

test("tax is split proportionally to subtotal, not evenly", () => {
  // Lan eats 100k, Minh eats 300k. 10% tax = 40k total.
  // Lan pays 10k of tax, Minh pays 30k.
  const items = [
    item("i1", "A", 100000, 1, ["p1"]),
    item("i2", "B", 300000, 1, ["p2"]),
  ];
  const r = splitBill([lan, minh], items, { ...noExtras, taxPercent: 10 });
  assert.equal(r.people[0].taxShare, 10000);
  assert.equal(r.people[1].taxShare, 30000);
  assert.equal(r.people[0].total, 110000);
  assert.equal(r.people[1].total, 330000);
});

test("fixed tip amount is split proportionally", () => {
  const items = [
    item("i1", "A", 100000, 1, ["p1"]),
    item("i2", "B", 100000, 1, ["p2"]),
  ];
  const r = splitBill([lan, minh], items, { ...noExtras, tipFixed: 20000 });
  assert.equal(r.people[0].tipShare, 10000);
  assert.equal(r.people[1].tipShare, 10000);
  assert.equal(r.grandTotal, 220000);
});

test("percent tip works too", () => {
  const items = [item("i1", "A", 200000, 1, ["p1"])];
  const r = splitBill([lan, minh], items, { ...noExtras, tipPercent: 15 });
  assert.equal(r.tip, 30000);
  assert.equal(r.people[0].total, 230000);
});

test("unassigned items are flagged", () => {
  const items = [item("i1", "Mystery", 50000, 1, [])];
  const r = splitBill([lan, minh], items, noExtras);
  assert.deepEqual(r.unassignedItemIds, ["i1"]);
});

test("totals always add up exactly to the grand total", () => {
  // Awkward numbers that force rounding: 3 people, 33333đ item, 10% tax.
  const a: Person = { id: "a", name: "A", color: "#111" };
  const b: Person = { id: "b", name: "B", color: "#222" };
  const c: Person = { id: "c", name: "C", color: "#333" };
  const items = [item("i1", "Snack", 33333, 1, ["a", "b", "c"])];
  const r = splitBill([a, b, c], items, { ...noExtras, taxPercent: 10 });
  const sum = r.people.reduce((s, p) => s + p.total, 0);
  assert.equal(sum, Math.round(r.grandTotal));
});

test("VND formatting uses dot separators and no decimals", () => {
  assert.equal(formatMoney(125000, "VND"), "125.000đ");
  assert.equal(formatMoney(1234567, "VND"), "1.234.567đ");
});

test("USD formatting uses $ and cents", () => {
  assert.equal(formatMoney(12.5, "USD"), "$12.50");
});

test("EUR formatting uses € symbol and 2 decimals", () => {
  const s = formatMoney(1234.5, "EUR");
  assert.ok(s.startsWith("€"));
  assert.ok(s.endsWith("50"));
});

test("smallest unit: VND rounds to 1, USD/EUR to cents", () => {
  assert.equal(smallestUnit("VND"), 1);
  assert.equal(smallestUnit("USD"), 0.01);
  // A USD bill rounds leftovers to cents and still sums exactly
  const a: Person = { id: "a", name: "A", color: "#111" };
  const b: Person = { id: "b", name: "B", color: "#222" };
  const items = [item("i1", "Snack", 0.33, 1, ["a", "b"])];
  const r = splitBill([a, b], items, noExtras, 0.01);
  const sum = r.people.reduce((s, p) => s + p.total, 0);
  assert.ok(Math.abs(sum - 0.33) < 1e-9);
});

test("summary text lists each person and the total", () => {
  const items = [
    item("i1", "A", 100000, 1, ["p1"]),
    item("i2", "B", 200000, 1, ["p2"]),
  ];
  const r = splitBill([lan, minh], items, noExtras);
  const text = buildSummaryText(r, "VND");
  assert.ok(text.includes("Lan: 100.000đ"));
  assert.ok(text.includes("Minh: 200.000đ"));
  assert.ok(text.includes("Total: 300.000đ"));
});

test("summary text keeps cents in the USD total", () => {
  const items = [item("i1", "Coffee", 4.25, 1, ["p1"])];
  const r = splitBill([lan], items, noExtras, 0.01);
  const text = buildSummaryText(r, "USD");
  assert.ok(text.includes("Total: $4.25"), text); // 0% extras → cents preserved
});

test("summary total matches the per-person shares", () => {
  // $61.40 + 7.5% tax = $66.005: a half-cent. The total shown in the summary
  // must be exactly what the per-person shares add up to — no drift either way.
  const taxExtras = { taxPercent: 7.5, servicePercent: 0, tipPercent: 0, tipFixed: 0 };
  const items = [item("i1", "Dinner", 61.4, 1, ["p1", "p2"])];
  const r = splitBill([lan, minh], items, taxExtras, 0.01);
  const sharesSum = r.people.reduce((s, b) => s + b.total, 0);
  assert.equal(sharesSum, r.grandTotal); // shares and total agree
  const text = buildSummaryText(r, "USD");
  assert.ok(text.includes(`Total: $66.01`), text); // half-cent rounds up
});

test("grand total rounds half-cents up (no float drift)", () => {
  // $17 + 7.5% tax = $18.275 exactly. Binary float makes 18.275/0.01 land
  // just BELOW the rounding threshold, which used to report $18.27 — a cent
  // lower than the displayed subtotal ($17.00) + tax ($1.28) = $18.28.
  const taxExtras = { taxPercent: 7.5, servicePercent: 0, tipPercent: 0, tipFixed: 0 };
  const items = [item("i1", "Dinner", 17, 1, ["p1", "p2"])];
  const r = splitBill([lan, minh], items, taxExtras, 0.01);
  assert.equal(r.grandTotal, 18.28);
  assert.equal(r.tax, 1.28); // displayed parts must add up to the total
});

test("summary text warns when items are unassigned", () => {
  const items = [item("i1", "Mystery", 100000, 1, [])]; // no one assigned
  const r = splitBill([lan], items, noExtras);
  const text = buildSummaryText(r, "VND");
  assert.ok(text.includes("not assigned"), text);
});
