import assert from "node:assert/strict";
import test from "node:test";

import { mapWatchProviders, type TmdbWatchResults } from "./watch-providers";

const entry = (id: number, name: string, logo = `/logo-${id}.jpg`) => ({
  provider_id: id,
  provider_name: name,
  logo_path: logo,
});

const results: TmdbWatchResults = {
  SE: {
    flatrate: [entry(8, "Netflix"), entry(119, "Prime Video")],
    rent: [entry(8, "Netflix"), entry(3, "Google Play")],
    buy: [entry(3, "Google Play")],
  },
  US: {
    flatrate: [entry(337, "Disney Plus"), entry(15, "Hulu")],
  },
  GB: {
    flatrate: [entry(593, "iQIYI")],
  },
};

test("only the asked-for region is used", () => {
  const providers = mapWatchProviders(results, "SE");
  assert.deepEqual(
    providers.map((p) => p.Name),
    ["Netflix", "Prime Video", "Google Play"]
  );
});

test("a region with no offers returns nothing instead of every region", () => {
  // The "+64" bug: DJ is never in the payload, so the old code unioned all 100+ regions.
  assert.deepEqual(mapWatchProviders(results, "DJ"), []);
  assert.deepEqual(mapWatchProviders(results, "US").map((p) => p.Name), ["Disney Plus", "Hulu"]);
});

test("a provider listed in several buckets appears once", () => {
  const providers = mapWatchProviders(results, "SE");
  assert.equal(providers.filter((p) => p.Id === "8").length, 1);
  assert.equal(providers.filter((p) => p.Id === "3").length, 1);
});

test("no region and no payload are both empty", () => {
  assert.deepEqual(mapWatchProviders(results, null), []);
  assert.deepEqual(mapWatchProviders(results, ""), []);
  assert.deepEqual(mapWatchProviders(null, "SE"), []);
  assert.deepEqual(mapWatchProviders(undefined, "SE"), []);
});

test("entries without a logo are skipped, and the logo path is absolute", () => {
  const providers = mapWatchProviders(
    { SE: { flatrate: [entry(1, "No logo", ""), entry(2, "Relative", "abc.jpg")] } },
    "SE"
  );
  assert.deepEqual(providers, [{ Id: "2", Name: "Relative", LogoPath: "/abc.jpg" }]);
});
