import { DEFAULT_LANGUAGES } from "./constants";
import { deriveDeckMode } from "./deck-mode";
import type { MediaKind } from "@/types/media";
import type { Filters } from "@/types/session";

/**
 * The filter drawer's state machine, in one place.
 *
 * Two things used to live in the component and disagreed with each other: the
 * state it started from, and the payload it saved on close. Anything the two
 * resolved differently (an absent `started` vs `"any"`, a legacy `kinds:
 * ["movie"]` vs the whole library, `sortBy` forced to Random by a hybrid deck)
 * looked like a user edit, so merely opening and closing the sheet patched the
 * session and the deck refetched. The rule here is that both sides run through
 * `resolveFilterState` -> `filtersFromState`, so "nothing changed" is equal by
 * construction rather than by a hand-written comparison.
 */

export type FilterMode = "include" | "exclude";

/** Where the runtime slider ends; `>= RUNTIME_MAX` means "no upper bound". */
export const RUNTIME_MAX = 240;

/**
 * A hybrid deck merges the library with streaming catalogues through the
 * deterministic-shuffle path, so its order is always random. It is not a user
 * choice, and it is locked only while a merge will actually run.
 */
export const HYBRID_SORT = "Random";

export interface FilterContext {
  /** The provider has shows, so "no kind picked" means every kind. */
  hasSeries: boolean;
  /** A library provider with TMDB catalogues available (Jellyfin + a token). */
  hybridCapable: boolean;
  /** The sort a deck uses when the user picks nothing: Popular on TMDB, else Trending. */
  defaultSort: string;
  /** Library year bounds — the span the Release Year slider covers. */
  minYear: number;
  maxYear: number;
  /** Streaming services offered in this region. */
  availableWatchProviderIds: string[];
  /**
   * Services the user picked in Settings. For a hybrid-capable provider this is
   * the deck's default selection: empty means "library only", which is what
   * makes a hybrid deck drop back to a plain library deck.
   */
  settingsWatchProviders: string[];
}

export interface FilterState {
  mediaKinds: ("movie" | "series")[];
  showUnit: "series" | "episode";
  seriesStatus: ("continuing" | "ended")[];
  watchingOnly: boolean;
  genres: string[];
  excludedGenres: string[];
  genreMode: FilterMode;
  ratings: string[];
  excludedRatings: string[];
  ratingMode: FilterMode;
  watchProviders: string[];
  themes: string[];
  excludedThemes: string[];
  themeMode: FilterMode;
  languages: string[];
  sortBy: string;
  unplayedOnly: boolean;
  yearRange: [number, number];
  runtimeRange: [number, number];
  minRating: number;
}

/**
 * The selection a deck uses when no filter names services.
 *
 * TMDB discover treats an absent list as "every catalogue", so its default is
 * everything offered. A hybrid library deck is the opposite: it merges only the
 * services the user picked in Settings, and nothing picked means the library
 * alone.
 */
export function watchProviderBaseline(ctx: FilterContext): string[] {
  return ctx.hybridCapable ? [...ctx.settingsWatchProviders] : [...ctx.availableWatchProviderIds];
}

/** True when a deck fetch will actually merge catalogues (mirrors media-service). */
export function hybridMergeActive(ctx: FilterContext, selection: string[]): boolean {
  return ctx.hybridCapable && selection.length > 0;
}

/** The sort a deck falls back to, given what the drawer has selected. */
export function effectiveDefaultSort(ctx: FilterContext, selection: string[]): string {
  return hybridMergeActive(ctx, selection) ? HYBRID_SORT : ctx.defaultSort;
}

function seriesKindsOf(stored: Filters | null | undefined, hasSeries: boolean): ("movie" | "series")[] {
  const explicit = stored?.kinds?.filter(
    (kind): kind is "movie" | "series" => kind === "movie" || kind === "series"
  );
  // The 1.x drawer wrote `kinds: ["movie"]` whenever nothing else was picked, so
  // on a provider with shows that shape means "everything" — a real films-only
  // choice carries `deckMode: "movies"` (the same rule as withDeckDefaults).
  if (explicit?.length) {
    const legacyFilmsOnly = !stored?.deckMode && explicit.length === 1 && explicit[0] === "movie" && hasSeries;
    return legacyFilmsOnly ? ["movie", "series"] : explicit;
  }
  const mode = stored?.deckMode;
  if (mode === "mixed") return ["movie", "series"];
  if (mode === "movies") return ["movie"];
  if (mode) return ["series"];
  return hasSeries ? ["movie", "series"] : ["movie"];
}

function sameStringSet(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  const set = new Set(a);
  return b.every((value) => set.has(value));
}

/** Stored filters -> the drawer's starting state. Legacy shapes resolve to what they ran as. */
export function resolveFilterState(stored: Filters | null | undefined, ctx: FilterContext): FilterState {
  const legacyMode = stored?.deckMode;
  const mediaKinds = seriesKindsOf(stored, ctx.hasSeries);
  // An empty list is a choice ("library only"), not an absent one: the server
  // reads a stored `watchProviders: []` as "no merge", so the drawer must too.
  const watchProviders = stored && stored.watchProviders
    ? [...stored.watchProviders]
    : watchProviderBaseline(ctx);
  const sortBy = stored?.sortBy || effectiveDefaultSort(ctx, watchProviders);
  const hasExcludedGenres = !!stored?.excludedGenres?.length;
  const hasExcludedRatings = !!stored?.excludedOfficialRatings?.length;
  const hasExcludedThemes = !!stored?.excludedThemes?.length;

  return {
    mediaKinds,
    showUnit: stored?.showUnit ?? (legacyMode === "continue" || legacyMode === "episodes" ? "episode" : "series"),
    seriesStatus: stored?.status?.length ? [...stored.status] : [],
    watchingOnly: stored?.started === "inProgress" || legacyMode === "continue",
    genres: hasExcludedGenres ? [] : [...(stored?.genres ?? [])],
    excludedGenres: hasExcludedGenres ? [...(stored?.excludedGenres ?? [])] : [],
    genreMode: hasExcludedGenres ? "exclude" : "include",
    ratings: hasExcludedRatings ? [] : [...(stored?.officialRatings ?? [])],
    excludedRatings: hasExcludedRatings ? [...(stored?.excludedOfficialRatings ?? [])] : [],
    ratingMode: hasExcludedRatings ? "exclude" : "include",
    watchProviders,
    themes: hasExcludedThemes ? [] : [...(stored?.themes ?? [])],
    excludedThemes: hasExcludedThemes ? [...(stored?.excludedThemes ?? [])] : [],
    themeMode: hasExcludedThemes ? "exclude" : "include",
    languages: stored?.tmdbLanguages?.length ? [...stored.tmdbLanguages] : [...DEFAULT_LANGUAGES],
    sortBy,
    unplayedOnly: stored?.unplayedOnly ?? true,
    yearRange: stored?.yearRange ? [stored.yearRange[0], stored.yearRange[1]] : [ctx.minYear, ctx.maxYear],
    runtimeRange: stored?.runtimeRange ? [stored.runtimeRange[0], stored.runtimeRange[1]] : [0, RUNTIME_MAX],
    minRating: stored?.minCommunityRating ?? 0,
  };
}

/**
 * Drawer state -> the payload the session stores.
 *
 * Every value equal to its own default is dropped, so an untouched drawer
 * produces exactly the object an absent filter produces and a no-op close never
 * patches the session.
 */
export function filtersFromState(state: FilterState, ctx: FilterContext): Filters {
  const selectedKinds = state.mediaKinds.filter(
    (kind): kind is "movie" | "series" => kind === "movie" || kind === "series"
  );
  const kinds = selectedKinds.length ? selectedKinds : (["movie"] as ("movie" | "series")[]);
  const everyKind = ctx.hasSeries ? kinds.length > 1 : kinds.length === 1 && kinds[0] === "movie";
  const baselineProviders = watchProviderBaseline(ctx);
  const defaultSort = effectiveDefaultSort(ctx, state.watchProviders);
  const languagesAreDefault = sameStringSet(state.languages, DEFAULT_LANGUAGES);
  const yearIsDefault = state.yearRange[0] === ctx.minYear && state.yearRange[1] === ctx.maxYear;
  const runtimeIsDefault = state.runtimeRange[0] === 0 && state.runtimeRange[1] === RUNTIME_MAX;

  const out: Filters = {
    // `genres` is required by the type and every stored object carries it.
    genres: state.genreMode === "include" ? [...state.genres] : [],
  };

  if (state.genreMode === "exclude" && state.excludedGenres.length) {
    out.excludedGenres = [...state.excludedGenres];
  }
  if (state.ratingMode === "include" && state.ratings.length) {
    out.officialRatings = [...state.ratings];
  }
  if (state.ratingMode === "exclude" && state.excludedRatings.length) {
    out.excludedOfficialRatings = [...state.excludedRatings];
  }
  if (state.themeMode === "include" && state.themes.length) {
    out.themes = [...state.themes];
  }
  if (state.themeMode === "exclude" && state.excludedThemes.length) {
    out.excludedThemes = [...state.excludedThemes];
  }
  if (!sameStringSet(state.watchProviders, baselineProviders)) {
    out.watchProviders = [...state.watchProviders].sort();
  }
  if (!languagesAreDefault) {
    out.tmdbLanguages = [...state.languages];
  }
  if (state.sortBy && state.sortBy !== defaultSort) {
    out.sortBy = state.sortBy;
  }
  out.unplayedOnly = state.unplayedOnly;
  if (!yearIsDefault) {
    out.yearRange = [state.yearRange[0], state.yearRange[1]];
  }
  if (!runtimeIsDefault) {
    out.runtimeRange = [state.runtimeRange[0], state.runtimeRange[1]];
  }
  if (state.minRating > 0) {
    out.minCommunityRating = state.minRating;
  }

  // `kinds`/`deckMode` are written only when the deck is narrower than "everything":
  // a stored "everything" is the old fallback shape, not a choice (rule 13).
  if (!everyKind) {
    out.kinds = kinds;
    out.showUnit = state.showUnit;
    out.deckMode = deriveDeckMode({
      kinds,
      showUnit: state.showUnit,
      started: state.watchingOnly ? "inProgress" : "any",
    });
  }
  if (state.seriesStatus.length) {
    out.status = [...state.seriesStatus];
  }
  if (state.watchingOnly) {
    out.started = "inProgress";
  }

  return out;
}

/** Key-order-independent serialisation, so equal filters compare equal. */
export function stableFiltersKey(filters: Filters | null | undefined): string {
  if (!filters) return "null";
  const sorted: Record<string, unknown> = {};
  for (const key of Object.keys(filters).sort()) {
    const value = (filters as unknown as Record<string, unknown>)[key];
    if (value === undefined) continue;
    sorted[key] = value;
  }
  return JSON.stringify(sorted);
}

/** Canonical form of a stored filter object: what the drawer would save for it. */
export function canonicalFilters(stored: Filters | null | undefined, ctx: FilterContext): Filters {
  return filtersFromState(resolveFilterState(stored, ctx), ctx);
}

/**
 * True when closing the drawer would store the same filters it opened with.
 * Both sides are canonical, so an untouched drawer is always a no-op.
 */
export function isFilterNoOp(stored: Filters | null | undefined, state: FilterState, ctx: FilterContext): boolean {
  return stableFiltersKey(canonicalFilters(stored, ctx)) === stableFiltersKey(filtersFromState(state, ctx));
}

/**
 * Whether the deck is actually narrowed. Lives here so the dot on the filter
 * button and the saved payload cannot disagree — the dot used to light up for a
 * sort the deck had forced on itself.
 */
export function hasAppliedFilters(stored: Filters | null | undefined, ctx: FilterContext): boolean {
  if (!stored) return false;
  return stableFiltersKey(canonicalFilters(stored, ctx)) !== stableFiltersKey(canonicalFilters({ genres: [] }, ctx));
}
