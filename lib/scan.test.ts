// Tests for receipt-scan JSON validation. Run with: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { validateScannedReceipt } from "./scan.ts";

test("accepts a well-formed receipt", () => {
  const r = validateScannedReceipt({
    items: [{ name: "Phở bò", price: 85000, qty: 2 }],
    subtotal: 170000,
    tax: 17000,
    service: 0,
    total: 187000,
    currency: "VND",
  });
  assert.ok(r);
  assert.equal(r.items.length, 1);
  assert.equal(r.items[0].qty, 2);
  assert.equal(r.total, 187000);
});

test("qty defaults to 1 when missing or invalid", () => {
  const r = validateScannedReceipt({
    items: [{ name: "Trà sữa", price: 45000 }],
    subtotal: 45000, tax: 0, service: 0, total: 45000, currency: "VND",
  });
  assert.equal(r?.items[0].qty, 1);
});

test("rejects non-objects and missing items array", () => {
  assert.equal(validateScannedReceipt(null), null);
  assert.equal(validateScannedReceipt("hello"), null);
  assert.equal(validateScannedReceipt({ items: "nope" }), null);
});

test("rejects items without a name; skips discount lines with negative price", () => {
  assert.equal(
    validateScannedReceipt({ items: [{ name: "", price: 1, qty: 1 }] }),
    null
  );
  // A discount line (negative amount) is dropped, not fatal — the rest of
  // the receipt still comes through.
  const r = validateScannedReceipt({
    items: [
      { name: "X", price: -5, qty: 1 },
      { name: "Pho", price: 85000, qty: 2 },
    ],
    subtotal: 170000,
    total: 170000,
    currency: "VND",
  });
  assert.ok(r);
  assert.deepEqual(r.items, [{ name: "Pho", price: 85000, qty: 2 }]);
});

test("missing numbers become 0, missing currency becomes VND", () => {
  const r = validateScannedReceipt({ items: [] });
  assert.ok(r);
  assert.equal(r.subtotal, 0);
  assert.equal(r.currency, "VND");
});
