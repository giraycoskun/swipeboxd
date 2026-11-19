"use client";

import React, { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Play,
  Star,
  Heart,
  Bookmark,
  ArrowSquareOut,
} from "@phosphor-icons/react/dist/ssr";
import { UserAvatarList } from "../session/UserAvatarList";
import { useQueryClient } from "@tanstack/react-query";
import { WatchProvider } from "@/types";
import { Skeleton } from "@/components/ui/skeleton";
import Link from "next/link";
import { OptimizedImage } from "@/components/ui/optimized-image";
import { MediaHero } from "./MediaHero";
import { Drawer, DrawerContent, DrawerTitle } from "../ui/drawer";
import { Avatar, AvatarFallback, AvatarImage } from "../ui/avatar";
import { useRuntimeConfig } from "@/lib/runtime-config";
import { useSession } from "@/hooks/api";
import { cn } from "@/lib/utils";
import { useMovieDetails } from "@/hooks/api/use-movie-detail";
import { useMovieActions } from "@/hooks/use-movie-actions";
import { QUERY_KEYS } from "@/hooks/api/query-keys";
import { TMDB_MOVIE_BASE_URL } from "@/lib/constants";
import { getLanguageLabel } from "@/lib/language";
import { getProviderDetailsUrl } from "@/lib/provider-links";
import { ProviderType } from "@/lib/providers/types";
import { isTmdbSourcedId, resolveItemSource } from "@/lib/providers/item-source";
import { SeriesDetailSection } from "@/components/shows/SeriesDetailSection";
import { FoldableList } from "@/components/ui/foldable-list";

/** Past this many services the "Available on" row is a wall, so it opens folded. */
const AVAILABLE_ON_FOLD_THRESHOLD = 10;
/** Two chip rows and a sliver of the third, which the canon fade covers. */
const AVAILABLE_ON_FOLDED_HEIGHT = "4.5rem";
/** The sheet's open duration (see ui/sheet.tsx). Content swaps only after it. */
const OPEN_ANIMATION_MS = 280;

interface Props {
  movieId: string | null;
  onClose: () => void;
  showLikedBy?: boolean;
  sessionCode?: string | null;
}

export function MovieDetailView({ movieId, onClose, showLikedBy = true, sessionCode }: Props) {
  // The hero reads its parallax from this element; no React scroll handler in the way.
  const scrollRef = useRef<HTMLDivElement | null>(null);

  const { data: movie, isLoading } = useMovieDetails(movieId, sessionCode);

  /**
   * The open animation and the item request start together. If the detail lands
   * mid-slide, the sheet repaints a full-height subtree in one frame and drops nine
   * frames of the animation (144 ms measured at 6x CPU). The provider keys this
   * component on the movie id, so it mounts once per opened title: the cache lookup
   * and the "still sliding" state are initial values, not effect-driven updates.
   */
  const queryClient = useQueryClient();
  const [openedWithData] = useState(
    () => !!movieId && !!queryClient.getQueryData(QUERY_KEYS.movie(movieId, sessionCode, true))
  );
  const [settled, setSettled] = useState(!movieId);

  useEffect(() => {
    const timer = setTimeout(() => setSettled(true), OPEN_ANIMATION_MS);
    return () => clearTimeout(timer);
  }, []);

  // A warm sheet shows its content immediately; a cold one waits for the slide to end.
  const holdContent = !!movie && !openedWithData && !settled;

  const {
    isInList,
    isLikedByMe,
    isTogglingWatchlist,
    isUnliking,
    handleToggleWatchlist,
    handleUnlike,
    useWatchlist,
    isGuest
  } = useMovieActions(movie || null, {
    onUnlikeSuccess: onClose,
    sessionCode,
    includeUserState: true
  });

  const { serverPublicUrl: runtimeServerUrl, capabilities: runtimeCapabilities, provider: runtimeProvider } = useRuntimeConfig();
  const { data: sessionStatus } = useSession({ enabled: !!movieId });
  const capabilities = sessionStatus?.capabilities || runtimeCapabilities;
  const activeProvider = sessionStatus?.provider || runtimeProvider;
  const serverPublicUrl = runtimeServerUrl;
  const detailsUrl = getProviderDetailsUrl({
    provider: activeProvider,
    serverPublicUrl,
    machineId: sessionStatus?.machineId,
    itemId: movie?.Id || "",
  });
  const languageLabel = getLanguageLabel(movie?.Language);
  // Hybrid decks contain tmdb:-prefixed streaming-only items: no play link, no watchlist
  const isStreamingOnly = !!movie && isTmdbSourcedId(movie.Id);
  const tmdbLinkId = movie ? resolveItemSource(movie.Id).externalId : "";

  const ratingSource = movie?.CommunityRatingSource?.toLowerCase();
  const isRottenTomatoes = ratingSource?.includes("rottentomatoes") || ratingSource?.includes("tomato");
  const ratingDisplay = typeof movie?.CommunityRating === "number"
    ? (isRottenTomatoes ? Math.round(movie.CommunityRating * 10) : movie.CommunityRating.toFixed(1))
    : null;

  return (
    <Drawer open={!!movieId} onOpenChange={(open: boolean) => !open && onClose()}>
      <DrawerContent>
        <DrawerTitle className="sr-only">{movie?.Kind === "series" ? "Series details" : "Movie details"}</DrawerTitle>
        <div
          ref={scrollRef}
          className={cn(
            "p-0 overflow-y-auto h-[90vh] sm:max-w-full outline-none mt-1 no-scrollbar relative",
            "scroll-fade"
          )}>

          {isLoading || holdContent ? (
            <div className="h-64 w-full relative">
              <div className="absolute -bottom-12 left-4 flex items-end gap-3">
                <Skeleton className="w-28 h-40 rounded-lg shadow-2xl shadow-background border border-foreground/10 object-cover z-10 shrink-0" />
              </div>
              <Skeleton className="h-full w-full rounded-none relative mask-[linear-gradient(to_bottom,black_60%,transparent_100%)]" />
              <div className="space-y-4 px-6 mt-20">
                <Skeleton className="h-11 w-3/4" />
                <div className="flex flex-row w-2/3 gap-2">
                  <Skeleton className="h-10 w-32" />
                  <Skeleton className="h-10 w-32" />
                </div>
              </div>
            </div>
          ) : movie ? (
            <div className="relative">
              <MediaHero
                movie={movie}
                scrollRef={scrollRef}
                ratingDisplay={ratingDisplay}
                isRottenTomatoes={isRottenTomatoes}
              />

              {/* MAIN CONTENT */}
              <div className="relative z-20 p-6 bg-background">
                {movie.Taglines && movie.Taglines.length > 0 && (
                  <div className="mb-6 italic text-lg text-muted-foreground font-light border-l-2 border-primary/30 pl-4">
                    {movie.Taglines[0]}
                  </div>
                )}

                {movie.Kind === "series" && <SeriesDetailSection series={movie} />}

                <div className="flex gap-2 mb-8 flex-wrap">
                  {capabilities.requiresServerUrl && !isGuest && !isStreamingOnly ? (
                    <Link href={detailsUrl} className="w-32" target="_blank">
                      <Button className="w-32" size="lg">
                        <Play weight="fill" className="w-4 h-4 mr-2" /> Play
                      </Button>
                    </Link>
                  ) : (
                    <Link
                      href={`${TMDB_MOVIE_BASE_URL}/${tmdbLinkId}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-32"
                    >
                      <Button className="w-32" size="lg">
                        <ArrowSquareOut className="w-4 h-4 mr-2" /> See more
                      </Button>
                    </Link>
                  )}
                  {!isGuest && capabilities.hasAuth && capabilities.hasWatchlist && !isStreamingOnly && (
                    <Button
                      className="w-32"
                      size="lg"
                      variant={isInList ? "outline" : "secondary"}
                      onClick={() => handleToggleWatchlist()}
                      disabled={isTogglingWatchlist}
                    >
                      {useWatchlist ?
                        <Bookmark weight={isInList ? "fill" : "regular"} className="w-4 h-4 mr-2" />
                        : <Star weight={isInList ? "fill" : "regular"} className="w-4 h-4 mr-2" />
                      }
                      {useWatchlist ? "Watchlist" : "Favorite"}
                    </Button>
                  )}
                  {isLikedByMe && <Button
                    variant="outline"
                    size="lg"
                    aria-label="Unlike"
                    title="Unlike"
                    className="shrink-0 aspect-square p-0 text-destructive border-destructive/40 hover:bg-destructive/10"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleUnlike();
                    }}
                    disabled={isUnliking}
                  >
                    <Heart weight="fill" className="w-5 h-5 text-destructive" />
                  </Button>}
                </div>

                {/* LIKED BY */}
                {showLikedBy && movie.likedBy && movie.likedBy.length > 0 && (movie as any).sessionCode && (
                  <div className="mb-8 bg-muted/20 p-4 rounded-xl border border-border/50">
                    <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-3" >Liked By</h3>
                    <UserAvatarList users={movie.likedBy} size="lg" />
                  </div>
                )}

                {/* WATCH PROVIDERS */}
                {movie.WatchProviders && movie.WatchProviders.length > 0 && (
                  <div className="mb-8 bg-muted/20 p-4 rounded-xl border border-border/50">
                    <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-3 flex items-center gap-2">
                      Available On
                    </h3>
                    {/* A film can be on twenty services; the section folds like the season list
                        instead of pushing the synopsis off the bottom of the sheet. */}
                    <FoldableList
                      count={movie.WatchProviders.length}
                      threshold={AVAILABLE_ON_FOLD_THRESHOLD}
                      foldedHeight={AVAILABLE_ON_FOLDED_HEIGHT}
                      noun="service"
                    >
                      <div className="flex flex-wrap gap-2">
                        {movie.WatchProviders.map((provider: WatchProvider) => (
                          <div key={provider.Id} className="flex shrink-0 items-center gap-2 bg-background/50 border rounded-lg px-2.5 py-1.5">
                            <div className="relative size-5 overflow-hidden rounded shrink-0">
                              <OptimizedImage
                                src={`https://image.tmdb.org/t/p/w92${provider.LogoPath}`}
                                alt={provider.Name}
                                className="object-cover"
                                unoptimized
                                width={20}
                                height={20}
                              />
                            </div>
                            <span className="text-[11px] font-medium leading-none whitespace-nowrap">{provider.Name}</span>
                          </div>
                        ))}
                      </div>
                    </FoldableList>
                  </div>
                )}


                {/* DETAILS ROW */}
                  <div className="grid grid-cols-2 gap-8 mb-8">
                    <div>
                      <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-2">Director</h3>
                      <div className="text-foreground font-medium">
                        {movie.People?.find(p => p.Type === "Director")?.Name || "Unknown"}
                      </div>
                    </div>
                    {!!languageLabel && (
                      <div>
                        <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-2">Language</h3>
                        <div className="text-foreground font-medium truncate">
                          {languageLabel}
                        </div>
                      </div>
                    )}
                    {movie.Studios && movie.Studios.length > 0 && (
                      <div>
                        <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-2">Studio</h3>
                        <div className="text-foreground font-medium truncate">
                          {movie.Studios[0].Name}
                        </div>
                      </div>
                    )}
                  </div>

                {/* SYNOPSIS */}
                <div className="mb-8">
                  <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-3">Synopsis</h3>
                  <p className="text-foreground/90 text-base leading-relaxed">
                    {movie.Overview || "No overview available."}
                  </p>
                </div>


                {/* CAST */}
                {movie.People && movie.People.length > 0 && (
                  <div className="mb-8">
                    <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-4 flex items-center gap-2">
                      Cast
                    </h3>
                    <div className="flex overflow-x-auto gap-4 pb-4 no-scrollbar -mx-6 px-6">
                      {movie.People.filter(p => p.Type === "Actor").slice(0, 12).map(person => (
                        <div key={person.Id} className="flex flex-col items-center gap-2 min-w-20 text-center">
                          <Avatar className="w-16 h-16 border border-border shadow-sm">
                            <AvatarImage
                              src={person.PrimaryImageTag ? `/api/media/image/${person.Id}?tag=${person.PrimaryImageTag}` : undefined}
                              className="object-cover"
                            />
                            <AvatarFallback className="bg-muted text-muted-foreground text-xs">
                              {person.Name.split(" ").map((n: string) => n[0]).join("")}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex flex-col gap-0.5">
                            <div className="text-sm font-bold text-foreground leading-tight line-clamp-2 w-20">{person.Name}</div>
                            <div className="text-xs text-muted-foreground leading-tight line-clamp-2 w-20">{person.Role}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : null}
        </div>
      </DrawerContent>
    </Drawer>
  );
}
