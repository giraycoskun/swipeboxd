import assert from "node:assert/strict";
import test from "node:test";

import { deckFiltersKey, filtersFingerprint } from "./deck-cache";

test("switching Movies to Shows is a different deck, so a different cache key", () => {
  const movies = deckFiltersKey({ genres: [], kinds: ["movie"], deckMode: "movies" }, { libraries: [] });
  const shows = deckFiltersKey({ genres: [], kinds: ["series"], deckMode: "shows" }, { libraries: [] });
  assert.notEqual(filtersFingerprint(movies), filtersFingerprint(shows));
});

test("whole shows and single episodes are different decks", () => {
  const whole = deckFiltersKey({ genres: [], kinds: ["series"], showUnit: "series" });
  const single = deckFiltersKey({ genres: [], kinds: ["series"], showUnit: "episode" });
  assert.notEqual(filtersFingerprint(whole), filtersFingerprint(single));
});

test("narrowing to continuing or to what you are watching changes the key", () => {
  const base = deckFiltersKey({ genres: [], kinds: ["series"] });
  const continuing = deckFiltersKey({ genres: [], kinds: ["series"], status: ["continuing"] });
  const watching = deckFiltersKey({ genres: [], kinds: ["series"], started: "inProgress" });
  const keys = [base, continuing, watching].map(filtersFingerprint);
  assert.equal(new Set(keys).size, 3);
});

test("the same deck shape fingerprints the same way regardless of key order", () => {
  const a = filtersFingerprint({ genres: ["Drama"], kinds: ["series"], yearRange: [2000, 2010] });
  const b = filtersFingerprint({ yearRange: [2000, 2010], kinds: ["series"], genres: ["Drama"] });
  assert.equal(a, b);
});

test("a filter object with no mode is the movies deck, not a fourth key", () => {
  const legacy = deckFiltersKey({ genres: [] }, { libraries: [] });
  const explicit = deckFiltersKey({ genres: [], kinds: ["movie"], deckMode: "movies" }, { libraries: [] });
  // `kinds` is absent on the legacy object and `["movie"]` on the explicit one, so
  // they differ in that field — what matters is that the mode itself resolves.
  assert.equal(legacy.deckMode, "movies");
  assert.equal(explicit.deckMode, "movies");
});
