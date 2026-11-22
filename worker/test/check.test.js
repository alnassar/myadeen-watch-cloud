import { test } from "node:test";
import assert from "node:assert/strict";
import { norm, summarize, compare } from "../src/check.js";

const course = (id, name, seats, ordered) => ({
  id, name, url_key: `course-${id}`, seats, ordered_seats: String(ordered),
  booking: { multiple_dates: ["2026-12-01 12:00:00"] },
});

test("norm treats alef forms and spaces the same", () => {
  assert.equal(norm("دورة  رامي أمن"), "دورة رامي امن");
});

test("summarize keeps only Rami Aman courses and never goes below 0 seats", () => {
  const s = summarize([course(1, "دورة رامي امن 0070", 10, 3), course(2, "دورة رامي رياضي IPSC", 8, 9), course(3, "دورة رامي أمن 0071", 8, 9)]);
  assert.deepEqual(Object.keys(s), ["1", "3"]);
  assert.equal(s["1"].left, 7);
  assert.equal(s["3"].left, 0);
  assert.equal(s["1"].dates, "2026-12-01");
});

test("first run: no alert for a full course already listed", () => {
  const now = summarize([course(1, "دورة رامي امن 0069", 10, 10)]);
  assert.equal(compare(null, now).alerts.length, 0);
});

test("first run: alert if a course already has seats", () => {
  const now = summarize([course(1, "دورة رامي امن 0069", 10, 4)]);
  assert.equal(compare(null, now).alerts[0].title, "Seats available!");
});

test("new course after an empty list still alerts, even when full", () => {
  const now = summarize([course(2, "دورة رامي امن 0070", 10, 10)]);
  assert.equal(compare({}, now).alerts[0].title, "New Rami Aman course!");
});

test("seats opening in a full course alerts once", () => {
  const full = summarize([course(1, "دورة رامي امن 0069", 10, 10)]);
  const open = summarize([course(1, "دورة رامي امن 0069", 10, 9)]);
  assert.equal(compare(full, open).alerts[0].title, "Seats available!");
  assert.equal(compare(open, summarize([course(1, "دورة رامي امن 0069", 10, 8)])).alerts.length, 0);
});

test("nothing changed: no alert", () => {
  const s = summarize([course(1, "دورة رامي امن 0069", 10, 10)]);
  assert.equal(compare(s, s).alerts.length, 0);
});
