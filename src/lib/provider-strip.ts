/**
 * How many service logos fit a strip, and how many are left over.
 *
 * The row used to hard-code ten and let the flexbox shrink the tiles into dots:
 * a fixed count knows nothing about the width it lands in. The count is measured
 * instead, so a 448 px phone row and a 1440 px one both end with a truthful "+N".
 */

export interface StripMetrics {
  /** Tile edge in px. */
  tile: number;
  /** Space between tiles in px. */
  gap: number;
  /** Width reserved for the "+N" chip when anything is hidden. */
  badge: number;
  /** Below this many tiles the strip shows the badge alone rather than a sliver of one. */
  minTiles: number;
}

export interface StripFit {
  visible: number;
  hidden: number;
}

export const DEFAULT_STRIP_METRICS: StripMetrics = {
  tile: 20,
  gap: 6,
  badge: 38,
  // One logo and a count still tells you Netflix carries the film; zero logos is a
  // worse answer than a single tile, and the row in a phone card has about 65 px.
  minTiles: 1,
};

export function fitProviders(
  availablePx: number,
  total: number,
  metrics: StripMetrics = DEFAULT_STRIP_METRICS
): StripFit {
  if (total <= 0) return { visible: 0, hidden: 0 };
  // An unmeasured strip (server render) has no constraint; a measured empty one has none to give.
  if (availablePx === Number.POSITIVE_INFINITY) return { visible: total, hidden: 0 };
  if (!Number.isFinite(availablePx) || availablePx <= 0) return { visible: 0, hidden: total };

  const { tile, gap, badge, minTiles } = metrics;
  const perTile = tile + gap;

  // Everything fits: no badge needed.
  const withoutBadge = Math.floor((availablePx + gap) / perTile);
  if (withoutBadge >= total) return { visible: total, hidden: 0 };

  // Otherwise the badge takes the last slot(s), and a tile that does not fit is
  // not rendered at half size.
  const forTiles = availablePx - badge - gap;
  const withBadge = Math.floor((forTiles + gap) / perTile);
  if (withBadge < minTiles) return { visible: 0, hidden: total };

  const visible = Math.min(withBadge, total);
  return { visible, hidden: total - visible };
}
