import assert from "node:assert/strict";
import test from "node:test";

import { detailsServerUrl, getProviderDetailsUrl } from "./provider-links";
import { ProviderType } from "./providers/types";

/**
 * #99: the Watch link pointed at the server in compose, not the one the member is
 * signed into. `detailsServerUrl` is the one place that decides, so these are the
 * cases the two call sites (detail sheet, likes row) inherit.
 */

test("the session's own server wins over the instance URL", () => {
  assert.equal(
    detailsServerUrl("http://jellyfin-two:8096", "http://jellyfin-one:8096"),
    "http://jellyfin-two:8096",
  );
});

test("a session without a server URL falls back to the instance URL", () => {
  assert.equal(detailsServerUrl(undefined, "http://jellyfin-one:8096"), "http://jellyfin-one:8096");
  assert.equal(detailsServerUrl(null, "http://jellyfin-one:8096"), "http://jellyfin-one:8096");
  assert.equal(detailsServerUrl("", "http://jellyfin-one:8096"), "http://jellyfin-one:8096");
});

test("a blank session URL is not a server", () => {
  // `/api/session` sends `serverUrl` as a string it may not have filled in; whitespace
  // must not shadow a real fallback, or the link becomes "/web/index.html#…" on the app host.
  assert.equal(detailsServerUrl("   ", "http://jellyfin-one:8096"), "http://jellyfin-one:8096");
});

test("nothing configured anywhere yields an empty base, not the string 'undefined'", () => {
  assert.equal(detailsServerUrl(undefined, undefined), "");
  assert.equal(detailsServerUrl(undefined, null), "");
});

test("the details URL is built from the session's server, trailing slashes trimmed", () => {
  const serverPublicUrl = detailsServerUrl("http://jellyfin-two:8096/", "http://jellyfin-one:8096");
  assert.equal(
    getProviderDetailsUrl({ provider: ProviderType.JELLYFIN, serverPublicUrl, itemId: "abc" }),
    "http://jellyfin-two:8096/web/index.html#/details?id=abc&context=home",
  );
});

test("Plex keeps its machine segment on the session's server", () => {
  const serverPublicUrl = detailsServerUrl("http://plex-two:32400", "http://plex-one:32400");
  assert.equal(
    getProviderDetailsUrl({
      provider: ProviderType.PLEX,
      serverPublicUrl,
      machineId: "machine-2",
      itemId: "42",
    }),
    `http://plex-two:32400/web/index.html#!/server/machine-2/details?key=${encodeURIComponent("/library/metadata/42")}&context=${encodeURIComponent("source:content.library~0~2")}`,
  );
});

test("Plex without a machine id still builds a usable link", () => {
  const serverPublicUrl = detailsServerUrl("http://plex-two:32400", "");
  assert.equal(
    getProviderDetailsUrl({
      provider: ProviderType.PLEX,
      serverPublicUrl,
      machineId: null,
      itemId: "7",
    }),
    `http://plex-two:32400/web/index.html#!/details?key=${encodeURIComponent("/library/metadata/7")}&context=${encodeURIComponent("source:content.library~0~2")}`,
  );
});
