import { test } from "node:test";
import assert from "node:assert/strict";
import {
  addMonths,
  periods,
  days,
  moneyInput,
  defaults,
  project,
  parseReceipt,
  between,
} from "../src/finance.mjs";
test("real months and leap year", () => {
  assert.equal(days("2026-12-07", "2027-03-07"), 90);
  assert.equal(days("2027-03-07", "2027-06-07"), 92);
  assert.equal(addMonths("2028-01-31", 1), "2028-02-29");
  assert.equal(periods("2027-01-31")[1].end, "2027-03-31");
});
test("initial plan returns CAD 1528", () => {
  const s = defaults();
  assert.equal(
    project(s.trip, s.categories, [], "2026-11-01").plannedReturn,
    152800,
  );
});
test("money validation", () => {
  assert.equal(moneyInput("19,99"), 1999);
  assert.throws(() => moneyInput("12.333"));
  assert.throws(() => moneyInput("-1"));
  assert.throws(() => moneyInput("1e9"));
});
test("period boundary not double counted", () => {
  const xs = [{ date: "2027-01-07", amount: 100 }];
  assert.equal(between(xs, "2026-12-07", "2027-01-07").length, 0);
  assert.equal(between(xs, "2027-01-07", "2027-02-07").length, 1);
});
test("overspending and past savings preserved", () => {
  const s = defaults();
  s.expenses = [
    { date: "2026-12-08", amount: 100000, categoryId: "category-0" },
    { date: "2027-01-08", amount: 170000, categoryId: "category-0" },
  ];
  assert.equal(
    project(s.trip, s.categories, s.expenses, "2027-01-10").plannedReturn,
    107800,
  );
});
test("no premature pace; actual after trip", () => {
  const s = defaults();
  assert.equal(project(s.trip, s.categories, [], "2026-12-07").pace, null);
  assert.equal(
    project(
      s.trip,
      s.categories,
      [{ date: "2026-12-08", amount: 10000 }],
      "2027-04-01",
    ).plannedReturn,
    622800,
  );
});
test("receipt ignores subtotal tax change", () => {
  const r = parseReceipt(
    "NO FRILLS\n2026-12-08\nSUBTOTAL 24.00\nTAX 1.20\nTOTAL $25.20\nCASH 30.00\nCHANGE 4.80",
    defaults().categories,
  );
  assert.equal(r.amount, 2520);
  assert.equal(r.categoryId, "category-0");
  assert.equal(r.date, "2026-12-08");
});
test("no fabricated receipt fields", () => {
  assert.equal(parseReceipt("unclear text", []).amount, 0);
  assert.equal(parseReceipt("unclear text", []).categoryId, "");
});
