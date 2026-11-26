import { ProviderType } from "./providers/types";

/**
 * What size an image request should ask for, and how each provider spells it.
 *
 * The browser says "I need this many CSS pixels"; this module turns that into
 * the request a provider understands. It exists because those dialects are not
 * interchangeable and getting one wrong is silent: Jellyfin/Emby ignore `width`
 * and serve the original (a 2000×3000 poster, ~750 KB, re-encoded per request);
 * Plex ignores `width` on `/thumb` entirely and needs its photo transcoder; TMDB
 * encodes the size in the URL path, so a query param does nothing at all.
 *
 * Widths are snapped to a ladder rather than passed through, so one card has one
 * cache entry per size instead of one per device pixel ratio, and are capped by
 * `MAX_IMAGE_WIDTH` (env) — issue #94 asked for exactly that knob.
 */

/** Every width the deck may ask for. Snapping keeps the browser cache shared. */
export const IMAGE_WIDTH_LADDER = [16, 32, 48, 64, 96, 128, 160, 240, 320, 480, 640, 800, 960, 1200, 1600, 1920] as const;

export const DEFAULT_MAX_IMAGE_WIDTH = 960;
export const MIN_MAX_IMAGE_WIDTH = 160;
export const MAX_MAX_IMAGE_WIDTH = 1920;
export const DEFAULT_IMAGE_QUALITY = 75;

export interface ImageRequest {
  width: number;
  quality: number;
}

/** Clamp a configured cap into a range that can only ever be sensible. */
export function clampMaxImageWidth(maxWidth?: number | null): number {
  if (typeof maxWidth !== "number" || !Number.isFinite(maxWidth)) return DEFAULT_MAX_IMAGE_WIDTH;
  return Math.min(MAX_MAX_IMAGE_WIDTH, Math.max(MIN_MAX_IMAGE_WIDTH, Math.round(maxWidth)));
}

/**
 * Snap a requested width up to the ladder and down to the cap.
 *
 * Up, not down: a card must never be rendered from fewer pixels than it asked
 * for. Unknown or absent widths get the cap, because "no width" means "the
 * biggest thing this instance allows" — not "one pixel".
 */
export function normalizeImageWidth(requested?: number | null, maxWidth?: number | null): number {
  const cap = clampMaxImageWidth(maxWidth);
  const wanted = typeof requested === "number" && Number.isFinite(requested) && requested > 0 ? Math.ceil(requested) : cap;
  const bounded = Math.min(wanted, cap);
  for (const step of IMAGE_WIDTH_LADDER) {
    if (step >= bounded) return Math.min(step, cap);
  }
  return cap;
}

/** Read `width`/`quality` off a request, bounded on both ends. */
export function parseImageRequest(
  params: { get(name: string): string | null },
  maxWidth?: number | null
): ImageRequest {
  const rawWidth = Number(params.get("width"));
  const rawQuality = Number(params.get("quality"));
  return {
    width: normalizeImageWidth(Number.isFinite(rawWidth) ? rawWidth : null, maxWidth),
    quality:
      Number.isFinite(rawQuality) && rawQuality >= 1 && rawQuality <= 100
        ? Math.round(rawQuality)
        : DEFAULT_IMAGE_QUALITY,
  };
}

/**
 * The query string a provider expects for a sized image.
 *
 * - Jellyfin/Emby: `maxWidth`/`quality` on `/Items/{id}/Images/{type}`.
 * - Plex: `width`/`height` for its photo transcoder (the plain `/thumb` endpoint
 *   ignores them and serves the original).
 * - TMDB: the size is a path segment; `width` is carried to the provider, which
 *   strips it from the upstream query.
 */
export function imageQueryFor(provider: ProviderType | string | undefined, request: ImageRequest): Record<string, string> {
  switch (provider) {
    case ProviderType.JELLYFIN:
    case ProviderType.EMBY:
      return { maxWidth: String(request.width), quality: String(request.quality) };
    case ProviderType.PLEX:
      return {
        width: String(request.width),
        height: String(Math.round((request.width * 3) / 2)),
      };
    case ProviderType.TMDB:
      return { width: String(request.width) };
    case ProviderType.LETTERBOXD:
      return { width: String(request.width), quality: String(request.quality) };
    default:
      return {};
  }
}

/** `image.tmdb.org/t/p/<segment>` — the only sizes TMDB publishes. */
export function tmdbSizeSegment(width: number): string {
  if (width <= 185) return "w185";
  if (width <= 342) return "w342";
  if (width <= 500) return "w500";
  if (width <= 780) return "w780";
  return "original";
}
