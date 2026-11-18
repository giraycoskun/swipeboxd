import assert from "node:assert/strict";
import test from "node:test";

import { seededRandom, shuffleWithSeed } from "./utils";

test("the seeded generator only ever yields fractions in [0, 1)", () => {
  // Seeds whose hash is negative used to make this return negative numbers, and a
  // negative swap index writes `undefined` over a deck element.
  const seeds = ["a", "solo:user", "seed:episodes", "AB12CD", "breaking-bad", "z", "0", "ÿ"];
  for (const seed of seeds) {
    const random = seededRandom(seed);
    for (let i = 0; i < 200; i += 1) {
      const value = random();
      assert.ok(value >= 0 && value < 1, `seed ${seed} produced ${value}`);
    }
  }
});

test("a shuffle keeps every element exactly once", () => {
  const deck = Array.from({ length: 60 }, (_, i) => `item-${i}`);
  for (const seed of ["a", "seed:episodes", "solo:user", "AB12CD"]) {
    const shuffled = shuffleWithSeed(deck, seed);
    assert.equal(shuffled.length, deck.length);
    assert.equal(new Set(shuffled).size, deck.length);
    assert.deepEqual([...shuffled].sort(), [...deck].sort());
  }
});

test("the same seed shuffles the same way; a different seed does not", () => {
  const deck = Array.from({ length: 40 }, (_, i) => i);
  assert.deepEqual(shuffleWithSeed(deck, "session-1"), shuffleWithSeed(deck, "session-1"));
  assert.notDeepEqual(shuffleWithSeed(deck, "session-1"), shuffleWithSeed(deck, "session-2"));
});
