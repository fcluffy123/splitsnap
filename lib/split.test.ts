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

test("rounded tax/service parts sum to the displayed grand total", () => {
  // $16.90 + 5% tax + 15% service. Each extra rounds up on its own
  // (0.845 -> 0.85, 2.535 -> 2.54), so the total must be built from the
  // rounded parts ($20.29), not rounded independently ($20.28) — otherwise
  // the Results screen shows parts that don't add up to the total.
  const extras = { taxPercent: 5, servicePercent: 15, tipPercent: 0, tipFixed: 0 };
  const items = [item("i1", "Dinner", 16.9, 1, ["p1", "p2"])];
  const r = splitBill([lan, minh], items, extras, 0.01);
  assert.equal(r.tax, 0.85);
  assert.equal(r.service, 2.54);
  assert.equal(r.grandTotal, 16.9 + 0.85 + 2.54);
  const sharesSum = r.people.reduce((s, b) => s + b.total, 0);
  assert.equal(sharesSum, r.grandTotal); // shares and total still agree
});

test("summary text warns when items are unassigned", () => {
  const items = [item("i1", "Mystery", 100000, 1, [])]; // no one assigned
  const r = splitBill([lan], items, noExtras);
  const text = buildSummaryText(r, "VND");
  assert.ok(text.includes("not assigned"), text);
});

test("rounding never charges or credits someone who ordered nothing", () => {
  // Only Minh orders. $1.03 + 5% tax + 15% service: tax 0.0515 -> 0.05,
  // service 0.1545 -> 0.15, so the bill is $1.23. Minh pays all of it and
  // Lan (no items) pays exactly 0 — no -$0.01 credit.
  const extras = { taxPercent: 5, servicePercent: 15, tipPercent: 0, tipFixed: 0 };
  const items = [item("i1", "Tea", 1.03, 1, ["p2"])];
  const r = splitBill([lan, minh], items, extras, 0.01);
  assert.equal(r.people[0].total, 0);
  assert.ok(Math.abs(r.people[1].total - 1.23) < 1e-9);
  assert.ok(Math.abs(r.people[1].total - r.grandTotal) < 1e-9);
});

test("rounding leftover goes to a diner, not a non-diner listed first", () => {
  // Lan orders nothing; Minh and Hoa split 1 cent (0.005 each, both round up).
  // The -1 cent leftover must land on a diner, not on Lan.
  const hoa: Person = { id: "p3", name: "Hoa", color: "#22c55e" };
  const items = [item("i1", "Mint", 0.01, 1, ["p2", "p3"])];
  const r = splitBill([lan, minh, hoa], items, noExtras, 0.01);
  assert.equal(r.people[0].total, 0);
  const sum = r.people.reduce((s, p) => s + p.total, 0);
  assert.ok(Math.abs(sum - 0.01) < 1e-9);
});

test("each person's total equals the rounded parts on their card", () => {
  // $1 shared 3 ways + $1.30 for Minh, 7.5% tax + 5% service. Rounding the
  // combined charge used to give Hoa $0.38 while her card listed
  // $0.33 + $0.02 tax + $0.02 service = $0.37.
  const hoa: Person = { id: "p3", name: "Hoa", color: "#22c55e" };
  const extras = { taxPercent: 7.5, servicePercent: 5, tipPercent: 0, tipFixed: 0 };
  const items = [
    item("i1", "Rolls", 1, 1, ["p1", "p2", "p3"]),
    item("i2", "Tea", 1.3, 1, ["p2"]),
  ];
  const r = splitBill([lan, minh, hoa], items, extras, 0.01);
  const cents = (n: number) => Math.round(n * 100);
  for (const b of r.people) {
    const parts = cents(b.subtotal) + cents(b.taxShare) + cents(b.serviceShare) + cents(b.tipShare);
    assert.equal(cents(b.total), parts, b.person.name);
  }
  const sum = r.people.reduce((s, p) => s + p.total, 0);
  assert.equal(cents(sum), cents(r.grandTotal));
});

test("rounding never pushes a diner's share below zero", () => {
  // Lan's only item is half of a 1-cent mint. Everyone's rounded shares used
  // to overshoot the bill, and Lan (absorbing the leftover) owed -$0.01.
  const hoa: Person = { id: "p3", name: "Hoa", color: "#22c55e" };
  const tuan: Person = { id: "p4", name: "Tuan", color: "#f59e0b" };
  const extras = { taxPercent: 5, servicePercent: 15, tipPercent: 10, tipFixed: 0 };
  const items = [
    item("i1", "Tea", 0.29, 1, ["p2"]),
    item("i2", "Mint", 0.01, 1, ["p1", "p2"]),
    item("i3", "Rolls", 0.11, 1, ["p3", "p4"]),
  ];
  const r = splitBill([lan, minh, hoa, tuan], items, extras, 0.01);
  for (const b of r.people) assert.ok(b.total >= 0, `${b.person.name}: ${b.total}`);
  const sum = r.people.reduce((s, p) => s + p.total, 0);
  assert.equal(Math.round(sum * 100), Math.round(r.grandTotal * 100));
});
