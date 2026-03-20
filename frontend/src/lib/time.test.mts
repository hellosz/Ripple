import test from "node:test";
import assert from "node:assert/strict";

import { formatRelativeTime } from "./time.ts";

test("formatRelativeTime renders recent timestamps as minutes ago", () => {
  const now = new Date("2026-03-20T12:00:00.000Z").getTime();
  const value = "2026-03-20T11:57:00.000Z";
  assert.equal(formatRelativeTime(value, now, "en"), "3 minutes ago");
});

test("formatRelativeTime renders future timestamps for fresh delivery hints", () => {
  const now = new Date("2026-03-20T12:00:00.000Z").getTime();
  const value = "2026-03-20T12:00:30.000Z";
  assert.equal(formatRelativeTime(value, now, "en"), "in 30 seconds");
});

test("formatRelativeTime falls back to week granularity for older inputs", () => {
  const now = new Date("2026-03-20T12:00:00.000Z").getTime();
  const value = "2026-03-06T12:00:00.000Z";
  assert.equal(formatRelativeTime(value, now, "en"), "2 weeks ago");
});
