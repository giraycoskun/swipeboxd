"use client";

import React, { useEffect, useRef, useState, useMemo, useCallback } from "react";
import { VirtuosoGrid } from "react-virtuoso";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { Filters } from "@/types";
import {
  ArrowCounterClockwise,
  Star,
  Check,
  MagnifyingGlass,
  X,
} from "@phosphor-icons/react/dist/ssr";
import { Label } from "@/components/ui/label";
import { Button } from "../ui/button";
import { Skeleton } from "../ui/skeleton";
import { Switch } from "../ui/switch";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useFilters, useThemes, useSession, useWatchProviders, useUserSettings } from "@/hooks/api";
import { MediaGenre, MediaRating, MediaYear, WatchProvider } from "@/types/media";
import { OptimizedImage } from "../ui/optimized-image";
import { UserAvatarList } from "../session/UserAvatarList";
import { useRuntimeConfig } from "@/lib/runtime-config";
import { cn } from "@/lib/utils";
import { LANGUAGES, SORT_OPTIONS, POPULAR_LANGUAGE_CODES, DEFAULT_LANGUAGES } from "@/lib/constants";
import { CountryFlag } from "../ui/country-flag";
import { ProviderType } from "@/lib/providers/types";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group";

import {
  HYBRID_SORT,
  RUNTIME_MAX,
  effectiveDefaultSort,
  filtersFromState,
  hybridMergeActive,
  isFilterNoOp,
  resolveFilterState,
  stableFiltersKey,
  type FilterContext,
  type FilterState,
} from "@/lib/filters";
import { HybridTooltip, HybridTooltipTrigger, HybridTooltipContent } from "@/components/ui/hybrid-tooltip";
import type { DeckMode } from "@/types/session";

interface FilterDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentFilters: Filters;
  onSave: (filters: Filters) => void;
}


export function FilterDrawer({ open, onOpenChange, currentFilters, onSave }: FilterDrawerProps) {
  /**
   * The Media section is two toggles plus filters, not a mode picker: which kinds
   * are in the deck, and — when shows are included — whether a card is a whole
   * show or a single episode. `deckMode` used to be a five-way choice here; it is
   * now derived from these (see `deriveDeckMode`) so the server contract is
   * unchanged while the UI expresses relationships instead of exclusivity.
   */
  const [mediaKinds, setMediaKinds] = useState<("movie" | "series")[]>(["movie"]);
  const [showUnit, setShowUnit] = useState<"series" | "episode">("series");
  const [seriesStatus, setSeriesStatus] = useState<("continuing" | "ended")[]>([]);
  const [watchingOnly, setWatchingOnly] = useState(false);
  const [selectedGenres, setSelectedGenres] = useState<string[]>([]);
  const [excludedGenres, setExcludedGenres] = useState<string[]>([]);
  const [genreFilterMode, setGenreFilterMode] = useState<"include" | "exclude">("include");
  const [selectedRatings, setSelectedRatings] = useState<string[]>([]);
  const [excludedRatings, setExcludedRatings] = useState<string[]>([]);
  const [ratingFilterMode, setRatingFilterMode] = useState<"include" | "exclude">("include");
  const [selectedWatchProviders, setSelectedWatchProviders] = useState<string[]>([]);
  const [selectedThemes, setSelectedThemes] = useState<string[]>([]);
  const [excludedThemes, setExcludedThemes] = useState<string[]>([]);
  const [themeFilterMode, setThemeFilterMode] = useState<"include" | "exclude">("include");
  const [selectedLanguages, setSelectedLanguages] = useState<string[]>(DEFAULT_LANGUAGES);
  const [showAllLanguages, setShowAllLanguages] = useState(false);
  const [sortBy, setSortBy] = useState<string>("Trending");
  const [unplayedOnly, setUnplayedOnly] = useState<boolean>(true);
  const [yearRange, setYearRange] = useState<[number, number]>([1900, new Date().getFullYear()]);
  const [runtimeRange, setRuntimeRange] = useState<[number, number]>([0, RUNTIME_MAX]);
  const [minRating, setMinRating] = useState<number>(0);
  const [providersScrollParent, setProvidersScrollParent] = useState<HTMLElement | null>(null);
  const [providerSearch, setProviderSearch] = useState<string>("");

  const { data: session } = useSession();
  const defaultSort = session?.provider === ProviderType.TMDB ? "Popular" : "Trending"; // Popular works better with TMDB
  const isTmdb = session?.provider === ProviderType.TMDB;
  const { capabilities, tmdbDefaultRegion } = useRuntimeConfig();
  const { data: userSettings } = useUserSettings();
  // Any provider with streaming settings (TMDB, or Jellyfin in hybrid mode) has a watch region
  const watchRegion = capabilities.hasStreamingSettings ? (userSettings?.watchRegion || tmdbDefaultRegion) : undefined;

  const { genres, years, ratings, isLoading: isLoadingFilters } = useFilters(open, watchRegion);
  const { data: themes = [], isLoading: isLoadingThemes } = useThemes(open);
  const { data: watchProvidersData, isLoading: isLoadingProviders } = useWatchProviders(
    watchRegion,
    session?.code
  );

  const availableWatchProviders = watchProvidersData?.providers || [];
  const availableWatchProviderIds = useMemo(
    () => availableWatchProviders.map(p => p.Id),
    [availableWatchProviders]
  );
  const members = watchProvidersData?.members || [];
  const isLoading = isLoadingFilters || isLoadingThemes || isLoadingProviders;

  const minYearLimit = useMemo(() => {
    if (!years || years.length === 0) return 1900;
    const yearNums = years.map((y: MediaYear) => y.Value).filter((n) => !isNaN(n));
    return yearNums.length > 0 ? Math.min(...yearNums) : 1900;
  }, [years]);

  const maxYearLimit = useMemo(() => {
    if (!years || years.length === 0) return new Date().getFullYear();
    const yearNums = years.map((y: MediaYear) => y.Value).filter((n) => !isNaN(n));
    return yearNums.length > 0 ? Math.max(...yearNums) : new Date().getFullYear();
  }, [years]);

  /**
   * Everything the drawer's defaults depend on. `src/lib/filters.ts` owns the two
   * conversions (stored -> state -> payload); this is only the instance's facts.
   */
  const filterContext = useMemo<FilterContext>(() => ({
    hasSeries: capabilities.hasSeries,
    // The server merges catalogues only for a library provider with a TMDB token
    // (media-service `isHybridCapable`); capability alone is not the merge.
    hybridCapable: capabilities.hasStreamingSettings && session?.provider === ProviderType.JELLYFIN,
    defaultSort,
    minYear: minYearLimit,
    maxYear: maxYearLimit,
    availableWatchProviderIds,
    settingsWatchProviders: userSettings?.watchProviders ?? [],
  }), [
    capabilities.hasSeries,
    capabilities.hasStreamingSettings,
    session?.provider,
    defaultSort,
    minYearLimit,
    maxYearLimit,
    availableWatchProviderIds,
    userSettings?.watchProviders,
  ]);

  /**
   * Hybrid = a merge that will actually run. It was computed from the services
   * *available* in the region before, so a plain Jellyfin deck with a TMDB token
   * believed it was hybrid, hid every sort but Random, and forced Random into the
   * saved filters. Selecting a service is what starts a merge.
   */
  const hybridMerge = hybridMergeActive(filterContext, selectedWatchProviders);
  const sortDefault = effectiveDefaultSort(filterContext, selectedWatchProviders);

  /**
   * A sort that was only its mode's default follows the mode; a real choice stays.
   * Selecting or clearing services flips the merge on and off, and the locked
   * "Random" used to survive the flip and be stored as if the user had picked it.
   */
  const sortForSelection = (nextSelection: string[], currentSort: string) => {
    const previousDefault = effectiveDefaultSort(filterContext, selectedWatchProviders);
    const upcomingDefault = effectiveDefaultSort(filterContext, nextSelection);
    return currentSort === previousDefault ? upcomingDefault : currentSort;
  };

  const sortOptions = useMemo(() => {
    if (hybridMerge) return [HYBRID_SORT];
    return [
      sortDefault,
      ...SORT_OPTIONS.filter(option => option !== sortDefault)
    ];
  }, [sortDefault, hybridMerge]);

  /**
   * Applied once per opening, never while the user is editing: the effect used to
   * depend on `currentFilters` by identity, and CardDeck hands it a fresh
   * `{ genres: [] }` fallback on every render, so any unrelated re-render of the
   * deck reset the drawer under the user's fingers.
   */
  const initialisedFor = useRef<string | null>(null);
  const appliedState = (next: FilterState) => {
    setSelectedGenres(next.genres);
    setExcludedGenres(next.excludedGenres);
    setGenreFilterMode(next.genreMode);
    setSelectedRatings(next.ratings);
    setExcludedRatings(next.excludedRatings);
    setRatingFilterMode(next.ratingMode);
    setSelectedWatchProviders(next.watchProviders);
    setSelectedThemes(next.themes);
    setExcludedThemes(next.excludedThemes);
    setThemeFilterMode(next.themeMode);
    setSelectedLanguages(next.languages);
    setSortBy(next.sortBy);
    setUnplayedOnly(next.unplayedOnly);
    setYearRange(next.yearRange);
    setRuntimeRange(next.runtimeRange);
    setMinRating(next.minRating);
    setMediaKinds(next.mediaKinds);
    setShowUnit(next.showUnit);
    setSeriesStatus(next.seriesStatus);
    setWatchingOnly(next.watchingOnly);
    setProviderSearch("");
    setShowAllLanguages(false);
  };

  const currentState = (): FilterState => ({
    mediaKinds,
    showUnit,
    seriesStatus,
    watchingOnly,
    genres: selectedGenres,
    excludedGenres,
    genreMode: genreFilterMode,
    ratings: selectedRatings,
    excludedRatings,
    ratingMode: ratingFilterMode,
    watchProviders: selectedWatchProviders,
    themes: selectedThemes,
    excludedThemes,
    themeMode: themeFilterMode,
    languages: selectedLanguages,
    sortBy,
    unplayedOnly,
    yearRange,
    runtimeRange,
    minRating,
  });

  const filtersKey = stableFiltersKey(currentFilters);

  const applyWatchProviders = (next: string[]) => {
    setSelectedWatchProviders(next);
    setSortBy((current) => sortForSelection(next, current));
  };

  useEffect(() => {
    if (!open) {
      initialisedFor.current = null;
      return;
    }
    // The default service selection comes from the provider list, so the drawer
    // waits for it instead of initialising twice and wiping an early edit.
    if (isLoading) return;
    const key = `${filtersKey}|${filterContext.settingsWatchProviders.join(",")}|${filterContext.availableWatchProviderIds.join(",")}|${filterContext.minYear}-${filterContext.maxYear}`;
    if (initialisedFor.current === key) return;
    initialisedFor.current = key;
    appliedState(resolveFilterState(currentFilters, filterContext));
    // appliedState only touches setters; the state it writes is not a dependency.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, isLoading, filtersKey, filterContext]);

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      // Nothing is compared unless the drawer was actually initialised: a sheet
      // closed before its data arrived would otherwise save its placeholders.
      if (initialisedFor.current) {
        const next = currentState();
        if (!isFilterNoOp(currentFilters, next, filterContext)) {
          onSave(filtersFromState(next, filterContext));
        }
      }
      initialisedFor.current = null;
    }
    onOpenChange(newOpen);
  };

  const formatRuntime = (mins: number) => {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return `${h}:${m.toString().padStart(2, '0')}`;
  };

  /**
   * Reset means "no filters", not "films": the unconfigured deck on a provider
   * with shows is every kind, so resetting must not narrow it to movies. It also
   * starts from the same resolver the drawer opens with, which is why a reset on
   * an already-unfiltered deck now saves nothing and does not rebuild the deck.
   */
  const resetAll = () => {
    appliedState(resolveFilterState(null, filterContext));
  };

  const filteredSortOptions = sortOptions;
  const gap = 12;
  const popularLanguageSet = useMemo(() => new Set(POPULAR_LANGUAGE_CODES), []);
  const popularLanguages = useMemo(
    () => LANGUAGES.filter((lang) => popularLanguageSet.has(lang.code)),
    [popularLanguageSet]
  );
  const moreLanguages = useMemo(
    () => LANGUAGES.filter((lang) => !popularLanguageSet.has(lang.code)),
    [popularLanguageSet]
  );

  const toggleGenre = (genreName: string) => {
    if (genreFilterMode === "exclude") {
      setExcludedGenres(prev => prev.includes(genreName) ? prev.filter(g => g !== genreName) : [...prev, genreName]);
    } else {
      setSelectedGenres(prev => prev.includes(genreName) ? prev.filter(g => g !== genreName) : [...prev, genreName]);
    }
  };

  const handleGenreModeChange = (value: string) => {
    if (!value) return;
    const next = value as "include" | "exclude";
    if (next === genreFilterMode) return;
    if (next === "exclude") {
      setExcludedGenres(selectedGenres);
      setSelectedGenres([]);
    } else {
      setSelectedGenres(excludedGenres);
      setExcludedGenres([]);
    }
    setGenreFilterMode(next);
  };

  const toggleTheme = (theme: string) => {
    if (themeFilterMode === "exclude") {
      setExcludedThemes(prev => prev.includes(theme) ? prev.filter(t => t !== theme) : [...prev, theme]);
    } else {
      setSelectedThemes(prev => prev.includes(theme) ? prev.filter(t => t !== theme) : [...prev, theme]);
    }
  };

  const handleThemeModeChange = (value: string) => {
    if (!value) return;
    const next = value as "include" | "exclude";
    if (next === themeFilterMode) return;
    if (next === "exclude") {
      setExcludedThemes(selectedThemes);
      setSelectedThemes([]);
    } else {
      setSelectedThemes(excludedThemes);
      setExcludedThemes([]);
    }
    setThemeFilterMode(next);
  };

  const toggleRating = (ratingValue: string) => {
    if (ratingFilterMode === "exclude") {
      setExcludedRatings(prev => prev.includes(ratingValue) ? prev.filter(r => r !== ratingValue) : [...prev, ratingValue]);
    } else {
      setSelectedRatings(prev => prev.includes(ratingValue) ? prev.filter(r => r !== ratingValue) : [...prev, ratingValue]);
    }
  };

  const handleRatingModeChange = (value: string) => {
    if (!value) return;
    const next = value as "include" | "exclude";
    if (next === ratingFilterMode) return;
    if (next === "exclude") {
      setExcludedRatings(selectedRatings);
      setSelectedRatings([]);
    } else {
      setSelectedRatings(excludedRatings);
      setExcludedRatings([]);
    }
    setRatingFilterMode(next);
  };

  const gridComponents = useMemo(() => ({
    List: ({ children, style, ...props }: React.ComponentProps<"div">) => (
      <div
        {...props}
        style={{
          ...style,
          display: "grid",
          gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
          gap: `${gap}px`,
        }}
      >
        {children}
      </div>
    ),
    Item: ({ children, ...props }: React.ComponentProps<"div">) => (
      <div {...props} className="w-full">
        {children}
      </div>
    ),
  }), [gap]);

  const handleProvidersViewport = useCallback((node: HTMLDivElement | null) => {
    setProvidersScrollParent(node);
  }, []);

  const filteredWatchProviders = useMemo(() => {
    const query = providerSearch.trim().toLowerCase();
    if (!query) return availableWatchProviders;
    return availableWatchProviders.filter((provider) =>
      provider.Name?.toLowerCase().includes(query)
    );
  }, [availableWatchProviders, providerSearch]);

  return (
    <Drawer open={open} onOpenChange={handleOpenChange}>
      <DrawerContent className="h-[66vh] flex flex-col">
        <DrawerHeader className="border-b pb-4 shrink-0 relative">
          <DrawerTitle className="text-center w-full">
            Filters
          </DrawerTitle>
          <Button
            variant="ghost"
            size='sm'
            className="h-8 gap-2 text-muted-foreground hover:text-foreground text-xs absolute right-4 top-4"
            onClick={resetAll}
          >
            <ArrowCounterClockwise className="size-3" />
            Reset
          </Button>
        </DrawerHeader>

        <ScrollArea className="flex-1 overflow-y-auto" viewportRef={handleProvidersViewport}>
          <div className="flex flex-col gap-10 pt-6 pb-12 px-6">
            {isLoading ? (
              <div className="space-y-10">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="space-y-4">
                    <Skeleton className="h-6 w-24" />
                    <Skeleton className="h-12 w-full rounded-xl" />
                  </div>
                ))}
              </div>
            ) : (
              <>
                {/* Media Section: what goes in the deck, and what a show card is.
                    Two levels on purpose — the second row only exists when Shows is
                    selected, and it is visually subordinate because it narrows the
                    choice above rather than competing with it. */}
                <div className="space-y-3">
                  <div className="space-y-2">
                    <Label className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                      Media
                    </Label>
                    <div className="flex flex-wrap gap-2">
                      <Badge
                        variant={mediaKinds.includes("movie") ? "default" : "outline"}
                        className="cursor-pointer text-sm py-1.5 px-4 rounded-none transition-colors"
                        onClick={() => {
                          const next = mediaKinds.includes("movie")
                            ? mediaKinds.filter((k) => k !== "movie")
                            : [...mediaKinds, "movie" as const];
                          // Never leave the deck with nothing to show: the last
                          // selected kind stays on.
                          if (next.length > 0) setMediaKinds(next);
                        }}
                      >
                        Movies
                      </Badge>
                      <Badge
                        variant={mediaKinds.includes("series") ? "default" : "outline"}
                        className={`text-sm py-1.5 px-4 rounded-none transition-colors ${capabilities.hasSeries ? "cursor-pointer" : "cursor-not-allowed opacity-40"}`}
                        aria-disabled={!capabilities.hasSeries}
                        onClick={() => {
                          if (!capabilities.hasSeries) return;
                          const next = mediaKinds.includes("series")
                            ? mediaKinds.filter((k) => k !== "series")
                            : [...mediaKinds, "series" as const];
                          if (next.length > 0) setMediaKinds(next);
                        }}
                      >
                        Shows
                      </Badge>
                    </div>
                  </div>

                  {mediaKinds.includes("series") && (
                    <div className="ml-1 space-y-3 border-l border-border pl-3">
                      <div className="space-y-1.5">
                        <span className="text-xs uppercase tracking-wider text-muted-foreground">Cards</span>
                        <div className="flex flex-wrap gap-1.5">
                          {([
                            { unit: "series" as const, label: "Whole shows", enabled: true },
                            {
                              unit: "episode" as const,
                              label: "Single episodes",
                              // Movies and episodes in one deck is a puzzle, not a feature.
                              enabled: !mediaKinds.includes("movie"),
                            },
                          ]).map(({ unit, label, enabled }) => {
                            const chip = (
                              <Badge
                                variant={showUnit === unit ? "default" : "outline"}
                                className={`text-xs py-1 px-3 rounded-none transition-colors ${enabled ? "cursor-pointer" : "cursor-not-allowed opacity-40"}`}
                                aria-disabled={!enabled}
                                onClick={() => enabled && setShowUnit(unit)}
                              >
                                {label}
                              </Badge>
                            );
                            // The reason lives in a tooltip (a popover on touch) so a
                            // disabled chip does not add a paragraph to the drawer.
                            if (enabled) return <span key={unit} className="contents">{chip}</span>;
                            return (
                              <HybridTooltip key={unit}>
                                <HybridTooltipTrigger asChild>{chip}</HybridTooltipTrigger>
                                <HybridTooltipContent side="top" className="max-w-56 text-xs">
                                  Episodes need Shows on its own — a deck of films and single
                                  episodes is two different questions.
                                </HybridTooltipContent>
                              </HybridTooltip>
                            );
                          })}
                      </div>
                      </div>

                      <div className="space-y-1.5">
                        <span className="text-xs uppercase tracking-wider text-muted-foreground">Narrow to</span>
                        <div className="flex flex-wrap gap-1.5">
                          {([
                            { key: "continuing" as const, label: "Continuing" },
                            { key: "ended" as const, label: "Ended" },
                          ]).map(({ key, label }) => (
                            <Badge
                              key={key}
                              variant={seriesStatus.includes(key) ? "default" : "outline"}
                              className="cursor-pointer text-xs py-1 px-3 rounded-none transition-colors"
                              onClick={() =>
                                setSeriesStatus((prev) =>
                                  prev.includes(key) ? prev.filter((s) => s !== key) : [...prev, key]
                                )
                              }
                            >
                              {label}
                            </Badge>
                          ))}
                          {(() => {
                            const canNarrow = capabilities.hasProgress && capabilities.hasNextUp;
                            const chip = (
                              <Badge
                                variant={watchingOnly ? "default" : "outline"}
                                className={`text-xs py-1 px-3 rounded-none transition-colors ${canNarrow ? "cursor-pointer" : "cursor-not-allowed opacity-40"}`}
                                aria-disabled={!canNarrow}
                                onClick={() => canNarrow && setWatchingOnly((prev) => !prev)}
                              >
                                Only what I&apos;m watching
                              </Badge>
                            );
                            if (canNarrow) return chip;
                            return (
                              <HybridTooltip>
                                <HybridTooltipTrigger asChild>{chip}</HybridTooltipTrigger>
                                <HybridTooltipContent side="top" className="max-w-56 text-xs">
                                  This provider keeps no watch progress, so there is nothing to
                                  narrow by.
                                </HybridTooltipContent>
                              </HybridTooltip>
                            );
                          })()}
                      </div>
                    </div>
                    </div>
                  )}
                </div>

                {/* Sort Section. A hybrid deck merges the library with streaming
                    catalogues on one seeded shuffle, so it cannot offer a pick:
                    the row states the order and why, instead of showing a choice
                    of one that looks like a filter you forgot to clear. */}
                <div className="space-y-4 -mb-4">
                  {hybridMerge ? (
                    <div className="space-y-2">
                      <div className="flex flex-wrap gap-2">
                        <Badge variant="default" className="text-sm py-1.5 px-4 rounded-none">
                          {HYBRID_SORT}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground font-medium">
                        Your library and the services you picked are merged into one deck, so
                        the order is always a shuffle. Deselect every service to sort the
                        library on its own.
                      </p>
                    </div>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {filteredSortOptions.map((option) => (
                        <Badge
                          key={option}
                          variant={sortBy === option ? "default" : "outline"}
                          className="cursor-pointer text-sm py-1.5 px-4 rounded-none transition-colors"
                          onClick={() => setSortBy(option)}
                        >
                          {option}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>

                {/* Watched Section */}
                {capabilities.hasAuth && (
                  // The row is the control: a 32x18 switch is a hard target on a phone, and the
                  // card was inert outside it. The switch stays as the visual, inert to pointers.
                  <div
                    role="switch"
                    aria-checked={unplayedOnly}
                    tabIndex={0}
                    onClick={() => setUnplayedOnly(!unplayedOnly)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        setUnplayedOnly(!unplayedOnly);
                      }
                    }}
                    className="flex cursor-pointer items-center justify-between gap-3 p-4 bg-muted/30 border border-border/50 transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
                  >
                    <div className="space-y-0.5">
                      <Label className="text-sm font-semibold tracking-tight">Hide Watched</Label>
                      <p className="text-xs text-muted-foreground font-medium">Only show items you haven&apos;t seen yet</p>
                    </div>
                    <Switch
                      checked={unplayedOnly}
                      tabIndex={-1}
                      aria-hidden="true"
                      className="pointer-events-none"
                    />
                  </div>
                )}

                {/* Rating Section */}
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <Label className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Community Rating</Label>
                    <span className="text-sm font-medium text-primary">
                      {minRating > 0 ? `${minRating}+ Stars` : "Any"}
                    </span>
                  </div>
                  <div className="flex gap-1 justify-between">
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((star) => (
                      <button
                        key={star}
                        onClick={() => setMinRating(star === minRating ? 0 : star)}
                        className="focus:outline-none transition-transform active:scale-90"
                      >
                        <Star
                          className={cn(
                            "size-6 transition-colors",
                            star <= minRating ? "fill-primary text-primary" : "text-muted-foreground/30"
                          )}
                        />
                      </button>
                    ))}
                  </div>
                </div>

                {/* Release Section */}
                <div className="space-y-6">
                  <div className="flex justify-between items-center">
                    <Label className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Release Year</Label>
                    <Badge variant="secondary" className="tabular-nums">
                      {yearRange[0]} — {yearRange[1]}
                    </Badge>
                  </div>
                  <div className="px-2">
                    <Slider
                      value={yearRange}
                      min={minYearLimit}
                      max={maxYearLimit}
                      step={1}
                      onValueChange={(val) => setYearRange(val as [number, number])}
                    />
                  </div>
                </div>

                {/* Runtime Section */}
                <div className="space-y-6">
                  <div className="flex justify-between items-center">
                    <Label className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Runtime</Label>
                    <Badge variant="secondary" className="tabular-nums">
                      {formatRuntime(runtimeRange[0])} — {runtimeRange[1] === RUNTIME_MAX ? "4:00+" : formatRuntime(runtimeRange[1])}
                    </Badge>
                  </div>
                  <div className="px-2">
                    <Slider
                      value={runtimeRange}
                      min={0}
                      max={RUNTIME_MAX}
                      step={5}
                      onValueChange={(val) => setRuntimeRange(val as [number, number])}
                    />
                  </div>
                </div>

                {/* Genres Section */}
                <div className="space-y-4">
                  <div className="space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <Label className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Genres</Label>
                    <ToggleGroup
                      type="single"
                      variant="outline"
                      size={'sm'}
                      value={genreFilterMode}
                      onValueChange={handleGenreModeChange}
                      className="flex mr-auto"
                    >
                      <ToggleGroupItem value="include" aria-label="Include genres">Include</ToggleGroupItem>
                      <ToggleGroupItem value="exclude" aria-label="Exclude genres">Exclude</ToggleGroupItem>
                    </ToggleGroup>
                    <div className="flex gap-3">
                      <button
                        onClick={() => {
                          if (genreFilterMode === "exclude") {
                            setExcludedGenres(genres.map(g => g.Name));
                            setSelectedGenres([]);
                          } else {
                            setSelectedGenres(genres.map(g => g.Name));
                            setExcludedGenres([]);
                          }
                        }}
                        className="text-xs font-semibold cursor-pointer text-primary hover:underline"
                      >
                        Select all
                      </button>
                      <button
                        onClick={() => {
                          if (genreFilterMode === "exclude") {
                            setExcludedGenres([]);
                          } else {
                            setSelectedGenres([]);
                          }
                        }}
                        className="text-xs font-semibold cursor-pointer text-muted-foreground hover:underline"
                      >
                        Clear
                      </button>
                    </div>
                  </div>
                </div>
                  <div className="flex flex-wrap gap-2">
                    {genres?.map((genre: MediaGenre) => {
                      const isSelected = genreFilterMode === "exclude"
                        ? excludedGenres.includes(genre.Name)
                        : selectedGenres.includes(genre.Name);
                      return (
                        <Badge
                          key={genre.Id}
                          variant={isSelected ? "default" : "outline"}
                          className={cn(
                            "cursor-pointer text-sm py-1.5 px-4 rounded-none",
                            genreFilterMode === "exclude" && isSelected && "bg-muted text-muted-foreground border-muted"
                          )}
                          onClick={() => toggleGenre(genre.Name)}
                        >
                          {genre.Name}
                        </Badge>
                      );
                    })}
                  </div>
                </div>

                {/* Themes Section */}
                {themes.length > 0 && (
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <Label className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Themes</Label>
                        <ToggleGroup
                          type="single"
                          variant="outline"
                          size={'sm'}
                          value={themeFilterMode}
                          onValueChange={handleThemeModeChange}
                          className="flex mr-auto"
                        >
                          <ToggleGroupItem value="include" aria-label="Include themes">Include</ToggleGroupItem>
                          <ToggleGroupItem value="exclude" aria-label="Exclude themes">Exclude</ToggleGroupItem>
                        </ToggleGroup>
                        <div className="flex gap-3">
                          <button
                            onClick={() => {
                              if (themeFilterMode === "exclude") {
                                setExcludedThemes(themes);
                                setSelectedThemes([]);
                              } else {
                                setSelectedThemes(themes);
                                setExcludedThemes([]);
                              }
                            }}
                            className="text-xs font-semibold cursor-pointer text-primary hover:underline"
                          >
                            Select all
                          </button>
                          <button
                            onClick={() => {
                              if (themeFilterMode === "exclude") {
                                setExcludedThemes([]);
                              } else {
                                setSelectedThemes([]);
                              }
                            }}
                            className="text-xs font-semibold cursor-pointer text-muted-foreground hover:underline"
                          >
                            Clear
                          </button>
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {themes.map((theme: string) => {
                        const isSelected = themeFilterMode === "exclude"
                          ? excludedThemes.includes(theme)
                          : selectedThemes.includes(theme);
                        return (
                          <Badge
                            key={theme}
                            variant={isSelected ? "default" : "outline"}
                            className={cn(
                              "cursor-pointer text-sm py-1.5 px-4 rounded-none",
                              themeFilterMode === "exclude" && isSelected && "bg-muted text-muted-foreground border-muted"
                            )}
                            onClick={() => toggleTheme(theme)}
                          >
                            {theme}
                          </Badge>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Maturity Ratings Section */}
                {ratings && ratings.length > 0 && (
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="flex items-center gap-2">
                          <Label className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                            Maturity rating
                          </Label>
                          {watchRegion && (
                            <Badge variant="outline" className="gap-1.5 py-0.5 px-2 h-5 font-bold opacity-80 bg-muted/30">
                              <div className="w-4 h-3 overflow-hidden rounded-[2px] shrink-0">
                                <CountryFlag countryCode={watchRegion} />
                              </div>
                            </Badge>
                          )}
                        </div>
                        <ToggleGroup
                          type="single"
                          variant="outline"
                          size={'sm'}
                          value={ratingFilterMode}
                          onValueChange={handleRatingModeChange}
                          className="flex mr-auto"
                        >
                          <ToggleGroupItem value="include" aria-label="Include ratings">Include</ToggleGroupItem>
                          <ToggleGroupItem value="exclude" aria-label="Exclude ratings">Exclude</ToggleGroupItem>
                        </ToggleGroup>
                        <div className="flex gap-3">
                          <button
                            onClick={() => {
                              if (ratingFilterMode === "exclude") {
                                setExcludedRatings(ratings.map(r => r.Value));
                                setSelectedRatings([]);
                              } else {
                                setSelectedRatings(ratings.map(r => r.Value));
                                setExcludedRatings([]);
                              }
                            }}
                            className="text-xs font-semibold cursor-pointer text-primary hover:underline"
                          >
                            Select all
                          </button>
                          <button
                            onClick={() => {
                              if (ratingFilterMode === "exclude") {
                                setExcludedRatings([]);
                              } else {
                                setSelectedRatings([]);
                              }
                            }}
                            className="text-xs font-semibold cursor-pointer text-muted-foreground hover:underline"
                          >
                            Clear
                          </button>
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {ratings.map((rating: MediaRating) => {
                        const isSelected = ratingFilterMode === "exclude"
                          ? excludedRatings.includes(rating.Value)
                          : selectedRatings.includes(rating.Value);
                        return (
                          <Badge
                            key={rating.Value}
                            variant={isSelected ? "default" : "outline"}
                            className={cn(
                              "cursor-pointer text-sm py-1.5 px-4 rounded-none",
                              ratingFilterMode === "exclude" && isSelected && "bg-muted text-muted-foreground border-muted"
                            )}
                            onClick={() => toggleRating(rating.Value)}
                          >
                            {rating.Name}
                          </Badge>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Language Section */}
                {isTmdb && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <Label className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Language</Label>
                      <button
                        onClick={() => setSelectedLanguages([])}
                        className="text-xs font-semibold cursor-pointer text-muted-foreground hover:underline"
                      >
                        Any language
                      </button>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {popularLanguages.map((lang) => (
                        <Badge
                          key={lang.code}
                          variant={selectedLanguages.includes(lang.code) ? "secondary" : "outline"}
                          className={cn(
                            "cursor-pointer text-sm py-1.5 px-4 rounded-none",
                            selectedLanguages.includes(lang.code) && "bg-primary/20 text-primary border-primary/30"
                          )}
                          onClick={() => setSelectedLanguages([lang.code])}
                        >
                          {lang.name}
                        </Badge>
                      ))}
                    </div>
                    {showAllLanguages && (
                      <div className="flex flex-wrap gap-2">
                        {moreLanguages.map((lang) => (
                          <Badge
                            key={lang.code}
                            variant={selectedLanguages.includes(lang.code) ? "secondary" : "outline"}
                            className={cn(
                              "cursor-pointer text-sm py-1.5 px-4 rounded-none",
                              selectedLanguages.includes(lang.code) && "bg-primary/20 text-primary border-primary/30"
                            )}
                            onClick={() => setSelectedLanguages([lang.code])}
                          >
                            {lang.name}
                          </Badge>
                        ))}
                      </div>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 px-2 text-xs"
                      onClick={() => setShowAllLanguages((prev) => !prev)}
                    >
                      {showAllLanguages ? "Show less" : "See more"}
                    </Button>
                  </div>
                )}

                {/* Watch Providers Section */}
                {capabilities.hasStreamingSettings && availableWatchProviders.length > 0 && (
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-2">
                        <Label className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                          Streaming Services
                        </Label>
                        {watchRegion && (
                          <Badge variant="outline" className="gap-1.5 py-0.5 px-2 h-5 font-bold opacity-80 bg-muted/30">
                            <div className="w-4 h-3 overflow-hidden rounded-[2px] shrink-0">
                              <CountryFlag countryCode={watchRegion} />
                            </div>
                          </Badge>
                        )}
                      </div>
                        <div className="flex gap-3">
                          <button onClick={() => applyWatchProviders(availableWatchProviderIds)} className="text-xs font-semibold cursor-pointer text-primary hover:underline">Select all</button>
                          <button onClick={() => applyWatchProviders([])} className="text-xs font-semibold cursor-pointer text-muted-foreground hover:underline">Clear</button>
                        </div>
                      </div>
                      <InputGroup className="bg-muted/30 border-input">
                        <InputGroupAddon align="inline-start">
                          <MagnifyingGlass className="size-4" />
                        </InputGroupAddon>
                        <InputGroupInput
                          placeholder="Search services..."
                          value={providerSearch}
                          onChange={(event) => setProviderSearch(event.target.value)}
                        />
                        <InputGroupAddon align="inline-end">
                          {providerSearch ? (
                            <InputGroupButton
                              variant="ghost"
                              size="icon-xs"
                              aria-label="Clear search"
                              onClick={() => setProviderSearch("")}
                            >
                              <X className="size-4" />
                            </InputGroupButton>
                          ) : null}
                        </InputGroupAddon>
                      </InputGroup>
                      {filteredWatchProviders.length === 0 ? (
                        <div className="text-xs text-center py-4 text-muted-foreground border rounded-md border-dashed">
                          No services match your search
                        </div>
                      ) : (
                        <VirtuosoGrid
                          data={filteredWatchProviders}
                          components={gridComponents}
                          style={{ height: "100%" }}
                          customScrollParent={providersScrollParent || undefined}
                          itemContent={(_, provider) => {
                            const isSelected = selectedWatchProviders.includes(provider.Id);
                            const providerMembers = (provider.MemberUserIds || [])
                              .map(id => {
                                const m = members.find(member => member.externalUserId === id);
                                if (!m) return null;
                                return {
                                  userId: m.externalUserId,
                                  userName: m.externalUserName,
                                  hasCustomProfilePicture: !!m.hasCustomProfilePicture,
                                  profileUpdatedAt: m.profileUpdatedAt
                                };
                              })
                              .filter(Boolean) as { userId: string, userName: string, hasCustomProfilePicture?: boolean, profileUpdatedAt?: string }[];

                            return (
                              <button
                                onClick={() => applyWatchProviders(selectedWatchProviders.includes(provider.Id) ? selectedWatchProviders.filter(id => id !== provider.Id) : [...selectedWatchProviders, provider.Id])}
                                className={cn(
                                  "relative flex items-center gap-3 p-3 rounded-xl border transition-all text-left cursor-pointer w-full",
                                  isSelected
                                    ? "bg-primary/5 border-primary shadow-sm"
                                    : "bg-background border-input text-muted-foreground opacity-85 grayscale-[0.5]"
                                )}
                              >
                                <div className="relative size-10 shrink-0 rounded-lg overflow-hidden border">
                                  <OptimizedImage
                                    src={`https://image.tmdb.org/t/p/w92${provider.LogoPath}`}
                                    alt={provider.Name}
                                    className="object-cover"
                                    unoptimized
                                    width={40}
                                    height={40}
                                  />
                                </div>
                                <div className="flex flex-col min-w-0 flex-1">
                                  <span className="text-xs font-bold truncate">{provider.Name}</span>
                                  {providerMembers.length > 0 && (
                                    <UserAvatarList
                                      users={providerMembers.map(m => ({
                                        userId: m.userId,
                                        userName: m.userName,
                                        hasCustomProfilePicture: !!m.hasCustomProfilePicture,
                                        profileUpdatedAt: m.profileUpdatedAt
                                      }))}
                                      size="sm"
                                      className="mt-1"
                                    />
                                  )}
                                </div>
                                {isSelected && (
                                  <Check className="size-4 text-primary shrink-0 stroke-3" />
                                )}
                              </button>
                            );
                          }}
                        />
                      )}
                  </div>
                )}

              </>
            )}
          </div>
        </ScrollArea>
      </DrawerContent>
    </Drawer>
  );
}
