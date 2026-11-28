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

test("rejects items without a name; discount lines feed the discount field", () => {
  assert.equal(
    validateScannedReceipt({ items: [{ name: "", price: 1, qty: 1 }] }),
    null
  );
  // A discount line (negative amount) is not an item: its amount is made
  // positive and collected into `discount`, and the rest of the receipt
  // still comes through.
  const r = validateScannedReceipt({
    items: [
      { name: "Open Discount", price: -74001, qty: 1 },
      { name: "Pho", price: 85000, qty: 2 },
    ],
    subtotal: 95000,
    total: 95000,
    currency: "VND",
  });
  assert.ok(r);
  assert.deepEqual(r.items, [{ name: "Pho", price: 85000, qty: 2 }]);
  assert.equal(r.discount, 74001);
});

test("explicit positive discount in the payload is kept; negatives never leak into items", () => {
  const r = validateScannedReceipt({
    items: [{ name: "Pho", price: 85000, qty: 2 }],
    discount: 5000,
    total: 165000,
  });
  assert.ok(r);
  assert.equal(r.discount, 5000);
});

test("missing numbers become 0, missing currency becomes VND", () => {
  const r = validateScannedReceipt({ items: [] });
  assert.ok(r);
  assert.equal(r.subtotal, 0);
  assert.equal(r.currency, "VND");
});

test("convenience-store receipt with per-item promos (Vinamilk store, total 101,000đ)", () => {
  // Real receipt: every item has a "Mua 1 tang 1" promo line under it with a
  // negative amount; Gemini-style JSON with the new per-item fields.
  const r = validateScannedReceipt({
    items: [
      {
        name: "VINAMILK Sua Yen Mach 180ml",
        qty: 2, lineTotal: 20000, discount: 6000, netTotal: 14000,
      },
      {
        name: "OTTO Banh Mi Bong Sua Hokkaido 40g",
        qty: 2, lineTotal: 24000, discount: 6000, netTotal: 18000,
      },
      {
        name: "7UP REVIVE Nuoc Uong Dien Giai",
        qty: 2, lineTotal: 18000, discount: 3000, netTotal: 15000,
      },
      {
        name: "VISSAN Xuc Xich Bo 70g",
        qty: 2, lineTotal: 18000, discount: 2000, netTotal: 16000,
      },
      {
        name: "MODERN Mi Bo 66g",
        qty: 1, lineTotal: 11000, discount: 0, netTotal: 11000,
      },
      {
        name: "MODERN Mi Kim Chi 66g",
        qty: 2, lineTotal: 14000, discount: 3000, netTotal: 11000,
      },
      {
        name: "SWING Khoai Tay Chien Vi Bo Bit",
        qty: 1, lineTotal: 16000, discount: 0, netTotal: 16000,
      },
      // A leaked promo line: net 0 or less AND promo-looking name → dropped.
      { name: "Mua 1 tang 1 Tiet kiem 2K", qty: 1, lineTotal: 0, discount: 0, netTotal: -2000 },
    ],
    subtotal: 0,
    totalDiscount: 20000,
    tax: 0,
    service: 0,
    total: 101000,
    currency: "VND",
    taxIncluded: true,
  });
  assert.ok(r);
  assert.equal(r.items.length, 7);
  const nets = r.items.map((it) => it.price * it.qty);
  assert.equal(nets.reduce((a, b) => a + b, 0), 101000);
  assert.equal(r.tax, 0);
  assert.equal(r.taxIncluded, true);
  // Unit prices: net / qty (e.g. Vinamilk 14,000 over qty 2 = 7,000đ each).
  assert.equal(r.items[0].price, 7000);
  assert.equal(r.items[0].qty, 2);
});
