import assert from "node:assert/strict";
import test from "node:test";

import type { MediaItem } from "@/types/media";
import {
  canServeContinuation,
  EPISODE_FETCH_PER_SHOW,
  EPISODE_SHOW_LIMIT,
  episodeFetchLimit,
  excludeSwiped,
  orderEpisodes,
  seriesIdsFromNextUp,
  slicePage,
  unwatchedEpisodes,
} from "./continue-deck";

const episode = (id: string, extra: Partial<MediaItem> = {}): MediaItem => ({
  Id: id,
  Name: `Episode ${id}`,
  ...extra,
});

const nextUp = [
  episode("e1", { SeriesId: "s1", SeriesName: "Breaking Bad" }),
  episode("e2", { SeriesId: "s2", SeriesName: "Better Call Saul" }),
  episode("e3", { SeriesId: "s1", SeriesName: "Breaking Bad" }),
];

test("a provider without next-up cannot serve a continuation deck", () => {
  assert.equal(canServeContinuation("continue", { hasNextUp: false, hasProgress: true }), false);
  assert.equal(canServeContinuation("episodes", { hasNextUp: false, hasProgress: true }), false);
});

test("continue needs watched state; episodes only needs the shelf", () => {
  assert.equal(canServeContinuation("continue", { hasNextUp: true, hasProgress: true }), true);
  assert.equal(canServeContinuation("continue", { hasNextUp: true, hasProgress: false }), false);
  assert.equal(canServeContinuation("episodes", { hasNextUp: true, hasProgress: false }), true);
});

test("swiped items never come back in a continuation deck", () => {
  const visible = excludeSwiped(nextUp, new Set(["e2"]));
  assert.deepEqual(visible.map((i) => i.Id), ["e1", "e3"]);
});

test("each show contributes its id once, in first-seen order, bounded", () => {
  assert.deepEqual(seriesIdsFromNextUp(nextUp), ["s1", "s2"]);
  assert.equal(seriesIdsFromNextUp(nextUp, 1).length, 1);
  assert.deepEqual(seriesIdsFromNextUp([episode("x")]), []);
});

test("watched and swiped episodes are dropped, not just the played flag", () => {
  const episodes = [
    episode("a"),
    episode("b", { UserData: { IsFavorite: false, Likes: false, Played: true } }),
    episode("c", { Progress: { played: true } }),
    episode("d"),
  ];
  const kept = unwatchedEpisodes(episodes, new Set(["d"]));
  assert.deepEqual(kept.map((e) => e.Id), ["a"]);
});

test("paging reports hasMore only when something is actually left", () => {
  const items = [1, 2, 3, 4, 5];
  assert.deepEqual(slicePage(items, 0, 2), { items: [1, 2], hasMore: true });
  assert.deepEqual(slicePage(items, 2, 2), { items: [5], hasMore: false });
  assert.deepEqual(slicePage([], 0, 20), { items: [], hasMore: false });
});

test("the episodes deck draws from a shortlist of shows, not the shelf", () => {
  const many = Array.from({ length: 20 }, (_, i) => episode(`x${i}`, { SeriesId: `s${i}` }));
  assert.equal(seriesIdsFromNextUp(many).length, EPISODE_SHOW_LIMIT);
  assert.deepEqual(seriesIdsFromNextUp(many), ["s0", "s1", "s2", "s3", "s4"]);
});

test("the per-show fetch budget is bounded and covers the page", () => {
  assert.equal(episodeFetchLimit(20), 40);
  assert.equal(episodeFetchLimit(1), EPISODE_FETCH_PER_SHOW);
  assert.equal(episodeFetchLimit(0), EPISODE_FETCH_PER_SHOW);
  assert.equal(episodeFetchLimit(500), EPISODE_FETCH_PER_SHOW * 2);
});

test("orderEpisodes drops watched, swiped and duplicate episodes", () => {
  const episodes = [
    episode("a", { SeasonNumber: 1, EpisodeNumber: 1 }),
    episode("b", { SeasonNumber: 1, EpisodeNumber: 2, UserData: { Played: true } as any }),
    episode("c", { SeasonNumber: 1, EpisodeNumber: 3 }),
    episode("a", { SeasonNumber: 1, EpisodeNumber: 1 }),
    episode("d", { SeasonNumber: 1, EpisodeNumber: 4 }),
  ];
  const ordered = orderEpisodes(episodes, new Set(["d"]), "seed:episodes");
  assert.deepEqual(ordered.map((e) => e.Id).sort(), ["a", "c"]);
});

test("the episodes deck order is stable for a session and changes with the seed", () => {
  const episodes = Array.from({ length: 12 }, (_, i) => episode(`e${i}`));
  const first = orderEpisodes(episodes, new Set(), "session-1:episodes").map((e) => e.Id);
  const again = orderEpisodes(episodes, new Set(), "session-1:episodes").map((e) => e.Id);
  const other = orderEpisodes(episodes, new Set(), "session-2:episodes").map((e) => e.Id);
  assert.deepEqual(first, again);
  assert.notDeepEqual(first, other);
});
