import assert from "node:assert/strict";
import test from "node:test";

import { dequeueMatch, enqueueMatch } from "./match-queue";
import type { MediaItem } from "@/types";

const item = (id: string) => ({ Id: id, Name: id }) as MediaItem;

test("matches queue in arrival order", () => {
  const queue = enqueueMatch(enqueueMatch([], item("a")), item("b"));
  assert.deepEqual(queue.map((i) => i.Id), ["a", "b"]);
});

test("the same match is never queued twice", () => {
  const queue = enqueueMatch(enqueueMatch([], item("a")), item("a"));
  assert.deepEqual(queue.map((i) => i.Id), ["a"]);
});

test("dismissing pops the head and keeps the rest", () => {
  const queue = enqueueMatch(enqueueMatch([], item("a")), item("b"));
  assert.deepEqual(dequeueMatch(queue).map((i) => i.Id), ["b"]);
});

test("dismissing an empty queue is a no-op", () => {
  assert.deepEqual(dequeueMatch([]), []);
});
