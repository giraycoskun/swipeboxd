"use client";

import { motion, useReducedMotion, useScroll, useTransform } from "framer-motion";
import type { RefObject } from "react";
import { Clock, HardDrives, Percent, ShieldCheck, Star } from "@phosphor-icons/react/dist/ssr";

import { Badge } from "@/components/ui/badge";
import { OptimizedImage } from "@/components/ui/optimized-image";
import { cn, ticksToTime } from "@/lib/utils";
import type { MediaItem } from "@/types";

interface Props {
  movie: MediaItem;
  /** The sheet's scroll container — the parallax is read from it, not from React events. */
  scrollRef: RefObject<HTMLDivElement | null>;
  ratingDisplay: string | number | null;
  isRottenTomatoes?: boolean;
}

/** How far the backdrop drifts over the first 300 px of scroll. Small on purpose. */
const PARALLAX_TRAVEL = 80;

/**
 * The detail sheet's hero: backdrop, poster, title block.
 *
 * The old version drove a framer motion value from React's `onScroll`, scaled the
 * bitmap 1 → 1.15 and cut it with a four-stop `mask-image`, all inside a scroller that
 * already carried `scroll-fade`. The image trailed the content by a frame, the mask was
 * re-rastered every frame, and the fade stopped mid-image instead of reaching the page.
 *
 * Now: `useScroll` reads the container (passive listener, framer's own rAF), the layer
 * translates only — no scale to re-raster — and the fade is a static gradient scrim the
 * browser paints once. Nothing here masks an image, and nothing blurs what is behind a
 * chip.
 */
export function MediaHero({ movie, scrollRef, ratingDisplay, isRottenTomatoes }: Props) {
  const prefersReducedMotion = useReducedMotion();
  const { scrollY } = useScroll({ container: scrollRef });

  const travel = prefersReducedMotion ? 0 : PARALLAX_TRAVEL;
  const imageY = useTransform(scrollY, [0, 300], [0, travel]);
  const imageOpacity = useTransform(scrollY, [0, 300], [1, prefersReducedMotion ? 1 : 0.6]);

  return (
    <div className="relative w-full h-80 overflow-hidden bg-background">
      {/* Overscan of one travel: the layer may slide down 80 px and still cover the box. */}
      <motion.div
        style={{ y: imageY, opacity: imageOpacity }}
        className="absolute inset-x-0 -top-20 h-[calc(100%+5rem)] will-change-transform"
      >
        <OptimizedImage
          src={movie.BackdropImageTags && movie.BackdropImageTags.length > 0
            ? `/api/media/image/${movie.Id}?imageType=Backdrop&tag=${movie.BackdropImageTags[0]}`
            : `/api/media/image/${movie.Id}?imageType=Backdrop`}
          externalId={movie.Id}
          imageType="Backdrop"
          alt="Backdrop"
          width={400}
          height={225}
          className="w-full h-full object-cover"
        />
      </motion.div>

      {/* One static scrim replaces the mask: the artwork dissolves into the page, not
          into a transparent band halfway down. */}
      <div
        className="absolute inset-0 bg-gradient-to-t from-background via-background/60 to-transparent"
        aria-hidden
      />

      {/* And the same dissolve at the top edge, so at rest the backdrop emerges from under
          the sheet's handle instead of starting on a hard line. */}
      <div
        className="absolute inset-x-0 top-0 h-20 bg-gradient-to-b from-background to-transparent"
        aria-hidden
      />

      {/* Header content */}
      <div className="absolute bottom-4 left-4 right-4 flex items-end gap-3">
        <OptimizedImage
          src={movie.ImageTags?.Primary
            ? `/api/media/image/${movie.Id}?tag=${movie.ImageTags?.Primary}`
            : `/api/media/image/${movie.Id}?imageType=Primary`
          }
          externalId={movie.Id}
          imageType="Primary"
          width={75}
          height={125}
          className="w-28 h-40 rounded-lg shadow-(--shadow-pop) border border-border object-cover z-10 shrink-0"
          alt="Poster"
        />
        <div className="flex-1 mb-1 z-10 overflow-hidden">
          {movie.Genres && movie.Genres.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-2">
              {movie.Genres.slice(0, 3).map(genre => (
                <span
                  key={genre}
                  className={cn(
                    "text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded",
                    // A solid chip, not a `backdrop-blur`: a blur inside a moving layer
                    // re-samples everything behind it on every frame.
                    "bg-background/80 text-foreground border border-border"
                  )}
                >
                  {genre}
                </span>
              ))}
            </div>
          )}
          <h2 className="text-3xl font-bold leading-tight drop-shadow-lg text-foreground mb-1 line-clamp-2">
            {movie.Name}
          </h2>
          {!!movie.OriginalTitle && movie.OriginalTitle !== movie.Name && (
            <div className="text-sm text-foreground/60 mb-2 truncate italic">
              {movie.OriginalTitle}
            </div>
          )}
          <div className="flex flex-wrap gap-3 text-xs items-center">
            {!!movie.ProductionYear && (
              <span className="font-semibold text-foreground/90 text-xs/0">
                {movie.ProductionYear}
              </span>
            )}
            {!!movie.OfficialRating && (
              <Badge variant="meta" className="border-foreground/30 text-foreground/80">
                <ShieldCheck className="w-3 h-3" />
                {movie.OfficialRating}
              </Badge>
            )}
            {movie.InLibrary && (
              <Badge variant="meta" className="border-foreground/30 text-foreground/80">
                <HardDrives className="w-3 h-3" />
                In Library
              </Badge>
            )}
            {!!movie.CommunityRating && ratingDisplay !== null && (
              <span className="flex items-center gap-1 font-bold text-xs/0">
                {isRottenTomatoes ? <Percent className="w-3 h-3" /> : <Star weight="fill" className="w-3 h-3" />}
                {ratingDisplay}{isRottenTomatoes ? "%" : ""}
              </span>
            )}
            {!!movie.RunTimeTicks && (
              <span className="flex items-center gap-1 text-foreground/70 text-xs/0">
                <Clock className="w-3 h-3" /> {ticksToTime(movie.RunTimeTicks)}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
