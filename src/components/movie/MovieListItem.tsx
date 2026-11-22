"use client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Play,
  Star,
  CalendarBlank,
  Heart,
  Clock,
  Bookmark,
  Percent,
} from "@phosphor-icons/react/dist/ssr";
import { cn, ticksToTime } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import Link from "next/link";
import { OptimizedImage } from "@/components/ui/optimized-image";
import { UserAvatarList } from "../session/UserAvatarList";
import { ProviderStrip } from "@/components/media/ProviderStrip";
import { MergedLike } from "@/types";
import { useRuntimeConfig } from "@/lib/runtime-config";
import { useMovieActions } from "@/hooks/use-movie-actions";
import { useQueryClient } from "@tanstack/react-query";
import { movieDetailQueryOptions } from "@/hooks/api/use-movie-detail";
import { detailsServerUrl, getProviderDetailsUrl } from "@/lib/provider-links";
import { isTmdbSourcedId } from "@/lib/providers/item-source";
import { useSession } from "@/hooks/api";
import type { ReactNode } from "react";


interface MovieListItemProps {
  movie: MergedLike;
  onClick?: () => void;
  variant?: "full" | "condensed";
  isLiked?: boolean;
}


export function MovieListItem({ movie, onClick, variant = "full", isLiked }: MovieListItemProps) {
  const { capabilities, serverPublicUrl: runtimeServerUrl, provider: runtimeProvider } = useRuntimeConfig();

  const { data: sessionStatus } = useSession();

  const {
    movie: syncedMovie,
    isInList,
    isLikedByMe,
    isTogglingWatchlist,
    isUnliking,
    handleToggleWatchlist,
    handleUnlike,
    useWatchlist
  } = useMovieActions(movie, { isLiked, includeUserState: true });

  const currentMovie = syncedMovie ? { ...movie, ...syncedMovie } : movie;
  // Hybrid decks contain tmdb:-prefixed streaming-only items: no play link, no watchlist
  const isStreamingOnly = isTmdbSourcedId(currentMovie.Id);
  // A row is EITHER a title you own — Play, no services — OR a streaming-only title, which has no
  // file to play and shows where it streams instead. Availability for a library title is the detail
  // sheet's job ("Available On"), so a list row never draws both. The likes payload still carries
  // the services (it seeds the sheet's cache), which is why the gate is `isStreamingOnly` and not
  // "does this row know its providers".
  //
  // The strip reads the ROW's payload, never the merged item: the item sync that follows a
  // favourite answers with `WatchProviders` even for a library title, which is what made a logo
  // appear under the finger and vanish again on the next reload.
  const listProviders = movie.WatchProviders ?? [];
  const hasPlayLink = capabilities.requiresServerUrl && !sessionStatus?.isGuest && !isStreamingOnly;
  const showStrip = capabilities.hasStreamingSettings && isStreamingOnly && listProviders.length > 0;
  const activeProvider = sessionStatus?.provider || runtimeProvider;
  // Same order as the detail sheet: the session's server, then the instance URL (#99).
  const serverPublicUrl = detailsServerUrl(sessionStatus?.serverUrl, runtimeServerUrl);
  const detailsUrl = getProviderDetailsUrl({
    provider: activeProvider,
    serverPublicUrl,
    machineId: sessionStatus?.machineId,
    itemId: currentMovie.Id,
  });

  // The list is the way into the detail sheet: warm the query on intent so the sheet
  // opens with content instead of swapping a skeleton in mid-slide.
  const queryClient = useQueryClient();
  const prefetchDetails = () => {
    if (isStreamingOnly) return;
    void queryClient.prefetchQuery(movieDetailQueryOptions(currentMovie.Id, movie.sessionCode));
  };

  const swipeDate = (() => {
    if (!currentMovie.swipedAt) return null;
    const raw = currentMovie.swipedAt;
    if (typeof raw !== "string") return null;
    const normalized = raw.includes("T") ? raw : raw.replace(" ", "T");
    const withZone = /Z|[+-]\d{2}:?\d{2}$/.test(normalized) ? normalized : `${normalized}Z`;
    const parsed = new Date(withZone);
    return Number.isNaN(parsed.getTime()) ? new Date(raw) : parsed;
  })();
  const formattedDate = swipeDate ? formatDistanceToNow(swipeDate, { addSuffix: true }) : "";
  const formattedDateText = formattedDate.substring(0, 1).toUpperCase() + formattedDate.substring(1);

  const isCondensed = variant === "condensed";
  const ratingSource = currentMovie.CommunityRatingSource?.toLowerCase();
  const isRottenTomatoes = ratingSource?.includes("rottentomatoes") || ratingSource?.includes("tomato");
  const ratingDisplay = typeof currentMovie.CommunityRating === "number"
    ? (isRottenTomatoes ? Math.round(currentMovie.CommunityRating * 10) : currentMovie.CommunityRating.toFixed(1))
    : null;

  const metaParts: { key: string; node: ReactNode }[] = [];
  if (currentMovie.ProductionYear) {
    metaParts.push({ key: "year", node: <span>{currentMovie.ProductionYear}</span> });
  }
  if (ratingDisplay !== null) {
    metaParts.push({
      key: "rating",
      node: (
        <span className="flex items-center">
          {isRottenTomatoes ? <Percent weight="fill" className="size-2.5 mr-0.5 mb-px" /> : <Star weight="fill" className="size-2.5 mr-0.5 mb-px" />}
          {ratingDisplay}{isRottenTomatoes ? "%" : ""}
        </span>
      ),
    });
  }
  // A series has no runtime; its third value is the season count.
  if (currentMovie.Kind === "series" && currentMovie.SeasonCount) {
    metaParts.push({
      key: "seasons",
      node: <span>{currentMovie.SeasonCount} season{currentMovie.SeasonCount === 1 ? "" : "s"}</span>,
    });
  } else if (currentMovie.RunTimeTicks) {
    metaParts.push({
      key: "runtime",
      node: (
        <span className="flex items-center">
          <Clock className="size-2.5 mr-0.5 mb-px" /> {ticksToTime(currentMovie.RunTimeTicks)}
        </span>
      ),
    });
  }

  return (
    <div
      onClick={onClick}
      onPointerEnter={prefetchDetails}
      onFocus={prefetchDetails}
      className={cn(
        "flex gap-4 mb-4 p-3 rounded-lg border transition-colors cursor-pointer bg-card border-border",
      )}
    >
      {/* Poster */}
      <div className={cn(
        isCondensed ? "relative shrink-0 w-15 h-22" : "relative shrink-0 w-20 h-28",
      )}>
        <OptimizedImage
          src={currentMovie.ImageTags?.Primary 
            ? `/api/media/image/${currentMovie.Id}?tag=${currentMovie.ImageTags?.Primary}`
            : `/api/media/image/${currentMovie.Id}`
          }
          alt={currentMovie.Name}
          externalId={currentMovie.Id}
          height={100}
          width={50}
          blurDataURL={currentMovie.BlurDataURL}
          className="w-full h-full object-cover rounded-md"
          sizes="(max-width: 768px) 75px, 100px"
        />
        {/* Match Indicator */}
        {!isCondensed && currentMovie.isMatch && (
          <Badge className="absolute -top-2 -right-2 h-5 px-1.5 text-[10px]">
            MATCH
          </Badge>
        )}
      </div>

      {/* Details */}
      <div className="flex flex-col justify-between flex-1 py-0.5 min-w-0">
        <div>
          <h3 className={cn(
            "font-sans font-bold line-clamp-2 leading-tight mb-1 text-foreground",
          )}>
            {currentMovie.Name}
          </h3>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground h-6">
            {/* Separators are inserted between values, never after them: a series has no runtime,
                and the old fixed "•" left a bullet dangling at the end of every show. */}
            {metaParts.map((part, index) => (
              <span key={part.key} className="flex items-center gap-1.5">
                {index > 0 && <span aria-hidden>•</span>}
                {part.node}
              </span>
            ))}
            <div className="ml-auto">
              {currentMovie.sessionCode && currentMovie.likedBy && currentMovie.likedBy.length > 0 && (
                <UserAvatarList
                  users={currentMovie.likedBy}
                  size="sm"
                  className="translate-y-0.5 mr-1"
                />
              )}
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-2 mt-2">
          {/* Only show date in full view */}
          {currentMovie.swipedAt && (
            <div className="text-xs text-muted-foreground flex items-center">
              <CalendarBlank className="size-2.5 mr-1 mb-0.5" />
              {formattedDateText}
            </div>
          )}

          {/* Two groups, never one wrapping row: the action (Play or the service strip) takes the
              space on the left, the state icons are pinned right — flush right in every
              combination, including a TMDB-only row that has no Play button to push them. */}
          <div className="flex items-center gap-2">
            <div className="flex min-w-0 flex-1 items-center gap-2">
              {hasPlayLink && <Link href={detailsUrl} onClick={e => e.stopPropagation()} className="min-w-0 flex-1">

                <Button
                  size="sm"
                  variant="secondary"
                  className={cn(
                    "h-7 text-xs w-full",
                  )}
                >
                  <Play className={cn("mr-2 w-2 h-2")} />
                  Play
                </Button>
              </Link>
              }
              {showStrip && (
                <ProviderStrip
                  providers={listProviders}
                  // No Play button — a streaming-only row. The services take the width the state
                  // icons leave and fold whatever does not fit into `+N`.
                  className="min-w-0 flex-1"
                />
              )}
            </div>
            <div className="ml-auto flex shrink-0 items-center gap-1">
              {!sessionStatus?.isGuest && capabilities.hasAuth && capabilities.hasWatchlist && !isStreamingOnly && (
                <Button
                  size="sm"
                  variant="ghost"
                  className={cn(
                    "h-7 w-7 p-0 text-muted-foreground hover:bg-muted",
                    isInList && "text-primary"
                  )}
                  onClick={handleToggleWatchlist}
                  disabled={isTogglingWatchlist}
                >
                  {useWatchlist ?
                    <Bookmark weight={isInList ? "fill" : "regular"} className="w-4 h-4" />
                    : <Star weight={isInList ? "fill" : "regular"} className="w-4 h-4" />
                  }
                </Button>
              )}
              {(isLikedByMe || isLiked) && <Button
                size="sm"
                variant="ghost"
                className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground hover:bg-muted"
                onClick={handleUnlike}
                disabled={isUnliking}
              >
                <Heart weight="fill" className="w-3.5 h-3.5 text-foreground" />
              </Button>}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
