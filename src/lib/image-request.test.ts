import assert from "node:assert/strict";
import test from "node:test";
import {
  clampMaxImageWidth,
  DEFAULT_MAX_IMAGE_WIDTH,
  imageQueryFor,
  normalizeImageWidth,
  parseImageRequest,
  tmdbSizeSegment,
} from "./image-request";
import { ProviderType } from "./providers/types";

const params = (query: string) => new URLSearchParams(query);

test("a 3x phone asking for 1344 gets the 960 cap, not 1600", () => {
  // 448 px pane × DPR 3 was the exact request in issue #94.
  assert.equal(normalizeImageWidth(1344, 960), 960);
  assert.equal(normalizeImageWidth(1344, 600), 600);
});

test("widths snap up to the ladder and never down", () => {
  assert.equal(normalizeImageWidth(500), 640);
  assert.equal(normalizeImageWidth(321), 480);
  assert.equal(normalizeImageWidth(320), 320);
  assert.equal(normalizeImageWidth(20), 32); // a small avatar stays small
});

test("a capped ladder still returns the cap when the rung is above it", () => {
  assert.equal(normalizeImageWidth(700, 640), 640);
  assert.equal(normalizeImageWidth(1600, 1200), 1200);
});

test("no width means the cap, nonsense means the cap", () => {
  assert.equal(normalizeImageWidth(undefined), DEFAULT_MAX_IMAGE_WIDTH);
  assert.equal(normalizeImageWidth(Number.NaN), DEFAULT_MAX_IMAGE_WIDTH);
  assert.equal(normalizeImageWidth(-5), DEFAULT_MAX_IMAGE_WIDTH);
  assert.equal(normalizeImageWidth(0, 640), 640);
});

test("the cap itself is clamped to something usable", () => {
  assert.equal(clampMaxImageWidth(0), 160);
  assert.equal(clampMaxImageWidth(99_999), 1920);
  assert.equal(clampMaxImageWidth(Number.NaN), DEFAULT_MAX_IMAGE_WIDTH);
  assert.equal(clampMaxImageWidth(959.6), 960);
});

test("quality is bounded and defaults to 75", () => {
  assert.equal(parseImageRequest(params("width=480"), 960).quality, 75);
  assert.equal(parseImageRequest(params("quality=0"), 960).quality, 75);
  assert.equal(parseImageRequest(params("quality=101"), 960).quality, 75);
  assert.equal(parseImageRequest(params("quality=90"), 960).quality, 90);
  assert.equal(parseImageRequest(params("quality=74.6"), 960).quality, 75);
});

test("client params cannot ask for more than the instance allows", () => {
  const request = parseImageRequest(params("width=4000&quality=75"), 960);
  assert.deepEqual(request, { width: 960, quality: 75 });
});

test("each provider gets the dialect it understands", () => {
  const request = { width: 480, quality: 75 };
  assert.deepEqual(imageQueryFor(ProviderType.JELLYFIN, request), { maxWidth: "480", quality: "75" });
  assert.deepEqual(imageQueryFor(ProviderType.EMBY, request), { maxWidth: "480", quality: "75" });
  assert.deepEqual(imageQueryFor(ProviderType.PLEX, request), { width: "480", height: "720" });
  assert.deepEqual(imageQueryFor(ProviderType.TMDB, request), { width: "480" });
  assert.deepEqual(imageQueryFor("unknown-provider", request), {});
});

test("jellyfin is never sent `width`, which it ignores", () => {
  const query = imageQueryFor(ProviderType.JELLYFIN, { width: 320, quality: 75 });
  assert.equal(query.width, undefined);
});

test("tmdb picks the published size that covers the request", () => {
  assert.equal(tmdbSizeSegment(120), "w185");
  assert.equal(tmdbSizeSegment(320), "w342");
  assert.equal(tmdbSizeSegment(342), "w342");
  assert.equal(tmdbSizeSegment(480), "w500"); // the smallest published size that covers 480
  assert.equal(tmdbSizeSegment(500), "w500");
  assert.equal(tmdbSizeSegment(640), "w780");
  assert.equal(tmdbSizeSegment(960), "original");
});
