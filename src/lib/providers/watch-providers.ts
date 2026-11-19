import type { WatchProvider } from "@/types/media";

/**
 * TMDB's availability payload, narrowed to what a card needs.
 * `results` is keyed by ISO 3166-1 region, and any region may be absent.
 */
export interface TmdbProviderEntry {
  provider_id: number;
  provider_name: string;
  logo_path?: string | null;
}

export interface TmdbRegionOffers {
  flatrate?: TmdbProviderEntry[];
  rent?: TmdbProviderEntry[];
  buy?: TmdbProviderEntry[];
  ads?: TmdbProviderEntry[];
  free?: TmdbProviderEntry[];
}

export type TmdbWatchResults = Record<string, TmdbRegionOffers | undefined>;

/** The five buckets TMDB splits an offer into; a provider may appear in several. */
const OFFER_BUCKETS = ["flatrate", "rent", "buy", "ads", "free"] as const;

/**
 * The services a title is available on **in one region**.
 *
 * The region is the whole point: a title that is not in the user's region has no
 * answer, and the truthful answer is an empty list. The 1.x code fell back to the
 * union of *every* region in the payload, which turned "not available in Djibouti"
 * into 74 worldwide services — the "+64" on the likes row, and a deck card claiming
 * every service on earth carries the film. Do not reintroduce a cross-region sweep:
 * `results` routinely holds 100+ regions, and their union is never a user's answer.
 */
export function mapWatchProviders(
  results: TmdbWatchResults | null | undefined,
  region: string | null | undefined
): WatchProvider[] {
  if (!results || !region) return [];
  const offers = results[region];
  if (!offers) return [];

  const providers = new Map<string, WatchProvider>();
  for (const bucket of OFFER_BUCKETS) {
    for (const entry of offers[bucket] ?? []) {
      if (!entry?.provider_id || !entry.logo_path) continue;
      const id = String(entry.provider_id);
      if (providers.has(id)) continue;
      const logo = entry.logo_path.startsWith("/") ? entry.logo_path : `/${entry.logo_path}`;
      providers.set(id, { Id: id, Name: entry.provider_name, LogoPath: logo });
    }
  }
  return Array.from(providers.values());
}
