import assert from "node:assert/strict";
import test from "node:test";

import {
  canonicalFilters,
  effectiveDefaultSort,
  filtersFromState,
  hasAppliedFilters,
  hybridMergeActive,
  isFilterNoOp,
  resolveFilterState,
  stableFiltersKey,
  watchProviderBaseline,
  type FilterContext,
} from "./filters";
import type { Filters } from "@/types/session";

const jellyfin: FilterContext = {
  hasSeries: true,
  hybridCapable: true,
  defaultSort: "Trending",
  minYear: 1900,
  maxYear: 2026,
  availableWatchProviderIds: ["8", "1899", "337"],
  settingsWatchProviders: [],
};

const hybrid: FilterContext = {
  ...jellyfin,
  settingsWatchProviders: ["8", "1899"],
};

const tmdb: FilterContext = {
  hasSeries: true,
  hybridCapable: false,
  defaultSort: "Popular",
  minYear: 1900,
  maxYear: 2026,
  availableWatchProviderIds: ["8", "1899", "337"],
  settingsWatchProviders: [],
};

const legacyShapes: (Filters | null)[] = [
  null,
  { genres: [] },
  { genres: [], kinds: ["movie"] },
  { genres: [], deckMode: "movies" as const, kinds: ["movie" as const] },
  { genres: [], deckMode: "mixed" as const, kinds: ["movie" as const, "series" as const] },
  { genres: [], deckMode: "shows" as const, kinds: ["series" as const], showUnit: "series" as const },
  { genres: [], deckMode: "continue" as const, kinds: ["series" as const], showUnit: "episode" as const, started: "inProgress" as const },
  { genres: ["Action"], yearRange: [1990, 2010] as [number, number], sortBy: "Random" },
  { genres: [], watchProviders: ["8"], sortBy: "Random" },
  { genres: [], watchProviders: ["8"], started: "any" as const, unplayedOnly: true },
];

test("an untouched drawer is always a no-op, for every stored shape", () => {
  for (const ctx of [jellyfin, hybrid, tmdb]) {
    for (const stored of legacyShapes) {
      const state = resolveFilterState(stored, ctx);
      assert.equal(
        isFilterNoOp(stored, state, ctx),
        true,
        `no-op failed for ${JSON.stringify(stored)} in ${ctx.hybridCapable ? "library" : "tmdb"} ctx`
      );
    }
  }
});

test("saving is idempotent: canonicalising twice changes nothing", () => {
  for (const ctx of [jellyfin, hybrid, tmdb]) {
    for (const stored of legacyShapes) {
      const once = canonicalFilters(stored, ctx);
      const twice = canonicalFilters(once, ctx);
      assert.equal(stableFiltersKey(twice), stableFiltersKey(once), JSON.stringify(stored));
    }
  }
});

test("showing a deck with everything selected stores no kinds at all", () => {
  const state = resolveFilterState(null, jellyfin);
  const filters = filtersFromState(state, jellyfin);
  assert.equal(filters.kinds, undefined);
  assert.equal(filters.deckMode, undefined);
  assert.equal(filters.sortBy, undefined);
});

test("a films-only choice is stored with its mode, so it survives the fallback rule", () => {
  const state = { ...resolveFilterState(null, jellyfin), mediaKinds: ["movie"] as ("movie" | "series")[] };
  const filters = filtersFromState(state, jellyfin);
  assert.deepEqual(filters.kinds, ["movie"]);
  assert.equal(filters.deckMode, "movies");
});

test("shows as single episodes narrowed to what I am watching is the continue deck", () => {
  const state = {
    ...resolveFilterState(null, jellyfin),
    mediaKinds: ["series"] as ("movie" | "series")[],
    showUnit: "episode" as const,
    watchingOnly: true,
  };
  const filters = filtersFromState(state, jellyfin);
  assert.equal(filters.deckMode, "continue");
  assert.equal(filters.started, "inProgress");
});

test("the hybrid default selection comes from Settings, not from every catalogue", () => {
  assert.deepEqual(watchProviderBaseline(hybrid), ["8", "1899"]);
  assert.deepEqual(watchProviderBaseline(jellyfin), []);
  assert.deepEqual(watchProviderBaseline(tmdb), ["8", "1899", "337"]);
});

test("no services picked means no hybrid merge, whatever the token allows", () => {
  assert.equal(hybridMergeActive(jellyfin, []), false);
  assert.equal(hybridMergeActive(jellyfin, ["8"]), true);
  assert.equal(hybridMergeActive(tmdb, ["8"]), false);
});

test("Random is the hybrid default, so it is not stored and does not light the dot", () => {
  // The Settings selection (Netflix + HBO) is the baseline, so the merge is on
  // without the drawer storing a service filter.
  const selected = resolveFilterState({ genres: [] }, hybrid);
  assert.deepEqual(selected.watchProviders, ["8", "1899"]);
  assert.equal(effectiveDefaultSort(hybrid, selected.watchProviders), "Random");
  const filters = filtersFromState({ ...selected, sortBy: "Random" }, hybrid);
  assert.equal(filters.sortBy, undefined);
  assert.equal(filters.watchProviders, undefined);
  assert.equal(hasAppliedFilters({ genres: [], sortBy: "Random" }, hybrid), false);
});

test("picking a service on top of the library is a real narrowing", () => {
  // The old drawer lit the dot for Random alone; a service selection is not that.
  assert.equal(hasAppliedFilters({ genres: [], watchProviders: ["8"], sortBy: "Random" }, jellyfin), true);
});

test("Random is still a real choice when no merge is running", () => {
  const state = { ...resolveFilterState(null, jellyfin), sortBy: "Random" };
  const filters = filtersFromState(state, jellyfin);
  assert.equal(filters.sortBy, "Random");
  assert.equal(hasAppliedFilters({ genres: [], sortBy: "Random" }, jellyfin), true);
});

test("a service selection equal to the Settings default is not stored", () => {
  const state = resolveFilterState(null, hybrid);
  assert.deepEqual(state.watchProviders, ["8", "1899"]);
  assert.equal(filtersFromState(state, hybrid).watchProviders, undefined);
});

test("year, runtime, language and rating defaults are dropped", () => {
  const state = resolveFilterState(
    { genres: [], yearRange: [1900, 2026], runtimeRange: [0, 240], tmdbLanguages: ["en"], minCommunityRating: 0 },
    jellyfin
  );
  const filters = filtersFromState(state, jellyfin);
  assert.equal(filters.yearRange, undefined);
  assert.equal(filters.runtimeRange, undefined);
  assert.equal(filters.tmdbLanguages, undefined);
  assert.equal(filters.minCommunityRating, undefined);
});

test("a real narrowing is written and lights the dot", () => {
  const state = { ...resolveFilterState(null, jellyfin), genres: ["Action"], minRating: 7 };
  const filters = filtersFromState(state, jellyfin);
  assert.deepEqual(filters.genres, ["Action"]);
  assert.equal(filters.minCommunityRating, 7);
  assert.equal(hasAppliedFilters(filters, jellyfin), true);
});

test("exclude mode writes the excluded list and not the included one", () => {
  const state = {
    ...resolveFilterState(null, jellyfin),
    genreMode: "exclude" as const,
    excludedGenres: ["Horror"],
  };
  const filters = filtersFromState(state, jellyfin);
  assert.deepEqual(filters.genres, []);
  assert.deepEqual(filters.excludedGenres, ["Horror"]);
});

test("Reset on an unconfigured deck stores nothing, so the deck is not rebuilt", () => {
  const stored = null;
  const reset = resolveFilterState(stored, jellyfin);
  assert.equal(isFilterNoOp(stored, reset, jellyfin), true);
  assert.equal(hasAppliedFilters(canonicalFilters(reset, jellyfin), jellyfin), false);
});

test("a stored empty service list means library only, not 'use my settings'", () => {
  const stored = { genres: [], watchProviders: [] };
  const state = resolveFilterState(stored, hybrid);
  assert.deepEqual(state.watchProviders, []);
  assert.equal(hybridMergeActive(hybrid, state.watchProviders), false);
  assert.equal(effectiveDefaultSort(hybrid, state.watchProviders), "Trending");
  // The explicit empty list is kept, because it is what turns the merge off.
  assert.deepEqual(canonicalFilters(stored, hybrid).watchProviders, []);
  assert.equal(isFilterNoOp(stored, state, hybrid), true);
});

test("the sort a mode forced does not survive the mode going away", () => {
  // Mirrors the drawer: a sort equal to the previous default follows the new one.
  const follow = (previous: string[], next: string[], current: string) =>
    current === effectiveDefaultSort(hybrid, previous) ? effectiveDefaultSort(hybrid, next) : current;
  assert.equal(follow(["8"], [], "Random"), "Trending");
  assert.equal(follow([], ["8"], "Trending"), "Random");
  // A real pick is kept across the flip.
  assert.equal(follow(["8"], [], "Top Rated"), "Top Rated");
  assert.equal(follow([], ["8"], "Newest"), "Newest");
});

test("a legacy cookie is cleaned once the user actually changes something", () => {
  const stored = { genres: [], kinds: ["movie" as const], started: "any" as const };
  const state = { ...resolveFilterState(stored, jellyfin), genres: ["Comedy"] };
  const filters = filtersFromState(state, jellyfin);
  assert.deepEqual(filters.genres, ["Comedy"]);
  assert.equal(filters.started, undefined);
  assert.equal(filters.kinds, undefined);
});
