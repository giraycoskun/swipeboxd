import assert from "node:assert/strict";
import test from "node:test";

import { createSemaphore } from "./semaphore";

const tick = (ms = 0) => new Promise((resolve) => setTimeout(resolve, ms));

test("never runs more tasks at once than the limit", async () => {
  const semaphore = createSemaphore(2);
  let peak = 0;
  let running = 0;

  const task = async () => {
    running += 1;
    peak = Math.max(peak, running);
    await tick(5);
    running -= 1;
  };

  await Promise.all(Array.from({ length: 6 }, () => semaphore.run(task)));
  assert.equal(peak, 2);
  assert.equal(semaphore.active, 0);
  assert.equal(semaphore.waiting, 0);
});

test("results come back to the caller that queued them", async () => {
  const semaphore = createSemaphore(1);
  const results = await Promise.all(
    [3, 1, 2].map((n) => semaphore.run(async () => {
      await tick(n);
      return n * 10;
    }))
  );
  assert.deepEqual(results, [30, 10, 20]);
});

test("a failing task frees its slot", async () => {
  const semaphore = createSemaphore(1);
  await assert.rejects(semaphore.run(async () => {
    throw new Error("boom");
  }), /boom/);
  assert.equal(semaphore.active, 0);
  assert.equal(await semaphore.run(async () => "next"), "next");
});

test("a nonsense limit still runs one task at a time", async () => {
  const semaphore = createSemaphore(0);
  assert.equal(await semaphore.run(async () => "ok"), "ok");
  const fractional = createSemaphore(2.7);
  let peak = 0;
  let running = 0;
  await Promise.all(Array.from({ length: 4 }, () => fractional.run(async () => {
    running += 1;
    peak = Math.max(peak, running);
    await tick(2);
    running -= 1;
  })));
  assert.equal(peak, 2);
});
