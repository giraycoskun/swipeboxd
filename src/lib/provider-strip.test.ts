import assert from "node:assert/strict";
import test from "node:test";

import { DEFAULT_STRIP_METRICS, fitProviders } from "./provider-strip";

const M = DEFAULT_STRIP_METRICS; // tile 20, gap 6, badge 38, minTiles 3

test("everything fits when the strip is wide enough", () => {
  // 3 tiles = 20*3 + 6*2 = 72
  assert.deepEqual(fitProviders(72, 3, M), { visible: 3, hidden: 0 });
  assert.deepEqual(fitProviders(400, 3, M), { visible: 3, hidden: 0 });
});

test("one pixel short of the last tile hides it", () => {
  assert.deepEqual(fitProviders(71, 3, M), { visible: 0, hidden: 3 });
});

test("a mid-width row shows filled tiles plus the count", () => {
  // 4 tiles alone = 98; with a badge: 20*n + 6*(n-1) + 6 + 38 <= 140
  const fit = fitProviders(140, 12, M);
  assert.ok(fit.visible >= 3);
  assert.equal(fit.visible + fit.hidden, 12);
  assert.ok(fit.visible * 20 + (fit.visible - 1) * 6 + 6 + 38 <= 140, "badge and tiles fit");
});

test("too narrow for three tiles means the count alone, never two dots", () => {
  assert.deepEqual(fitProviders(60, 12, M), { visible: 0, hidden: 12 });
  assert.deepEqual(fitProviders(1, 12, M), { visible: 0, hidden: 12 });
});

test("an unmeasured strip is unconstrained, a measured empty one shows nothing", () => {
  assert.deepEqual(fitProviders(Number.POSITIVE_INFINITY, 5, M), { visible: 5, hidden: 0 });
  assert.deepEqual(fitProviders(0, 5, M), { visible: 0, hidden: 5 });
  assert.deepEqual(fitProviders(-10, 5, M), { visible: 0, hidden: 5 });
  assert.deepEqual(fitProviders(200, 0, M), { visible: 0, hidden: 0 });
});

test("the hidden count covers the whole list, not just the capped prefix", () => {
  const fit = fitProviders(140, 74, M);
  assert.equal(fit.visible + fit.hidden, 74);
  assert.ok(fit.hidden > 60);
});
