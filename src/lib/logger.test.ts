import assert from "node:assert/strict";
import test from "node:test";

import { logger, recentLogs } from "./logger";

test("the ring keeps the newest lines and scrubs credentials", () => {
  const secretish = `msw_AbCd1234_${"x".repeat(43)}`;
  logger.info("plain line");
  logger.warn(`token ${secretish}`);
  logger.error(new Error("boom"));

  const entries = recentLogs({ limit: 3 });
  assert.equal(entries.length, 3);
  assert.equal(entries.at(-1)?.message, "Error: boom");
  assert.ok(entries.some((entry) => entry.message.includes("msw_***")));
  assert.ok(!entries.some((entry) => entry.message.includes("x".repeat(43))));
});

test("level filtering returns only that level", () => {
  logger.info("an info line");
  logger.error("an error line");

  const errors = recentLogs({ level: "error", limit: 20 });
  assert.ok(errors.length > 0);
  assert.ok(errors.every((entry) => entry.level === "error"));
  assert.ok(errors.some((entry) => entry.message.includes("an error line")));
});

test("a bearer header never survives into the buffer", () => {
  logger.warn("Authorization: Bearer abc.def.ghi");
  const entries = recentLogs({ limit: 5 });
  assert.ok(!entries.some((entry) => entry.message.includes("abc.def.ghi")));
});
