"use client";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { motion, useReducedMotion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { Heart } from "@phosphor-icons/react/dist/ssr";

import type { MediaItem } from "@/types";
import { Button } from "@/components/ui/button";
import { OptimizedImage } from "@/components/ui/optimized-image";
import { UserAvatarList } from "@/components/session/UserAvatarList";
import { apiClient } from "@/lib/api-client";
import { getRuntimeConfig } from "@/lib/runtime-config";
import { startHereHeading, type StartHereResult } from "@/lib/start-here";
import { useSession } from "@/hooks/api";

interface MatchTakeoverProps {
  item: MediaItem;
  sessionCode?: string | null;
  onContinue: () => void;
  onOpenDetails: () => void;
}

/**
 * A match owns the screen for as long as it takes to read it.
 *
 * Two rules keep it working, and both were learned the hard way:
 *
 * 1. It is a portal into `document.body`. As a plain fixed layer inside the tab
 *    panel it inherited that panel's animated transform, so `inset-0` sized it to
 *    the 448 px deck column instead of the viewport — a takeover that took over a
 *    column, on desktop only, with the Continue button pushed past the fold.
 * 2. It centres with `m-auto` inside a scrolling box, never with `justify-center`
 *    on an overflowing one. Centred overflow is unreachable overflow: on a short
 *    window the top half of the panel cannot be scrolled to.
 *
 * The poster is sized from the viewport (`42svh`, capped at its old 384 px) so it
 * stays the hero on a tall screen and steps aside on a short one. No backdrop
 * blur: that is the Firefox-Android cost #101 was.
 */
export function MatchTakeover({ item, sessionCode, onContinue, onOpenDetails }: MatchTakeoverProps) {
  const reduced = useReducedMotion();
  const continueRef = useRef<HTMLButtonElement>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  const isSeries = item.Kind === "series";
  const knowsProgress = getRuntimeConfig().capabilities.hasProgress;
  const { data: startHere } = useQuery({
    queryKey: ["match-start-here", item.Id],
    queryFn: async () => {
      const res = await apiClient.get<{ startHere: StartHereResult; hostOnly: boolean }>(
        "/api/media/start-here",
        { params: { seriesId: item.Id } }
      );
      return res.data;
    },
    enabled: isSeries && knowsProgress,
    retry: false,
  });

  const { data: session } = useSession();
  const likedBy = item.likedBy ?? [];
  const otherUsers = session?.userId
    ? likedBy.filter((user) => user.userId !== session.userId)
    : likedBy.slice(1);
  const otherLabel = otherUsers.length > 1
    ? `${otherUsers.length} others`
    : (otherUsers[0]?.userName || "someone");

  useEffect(() => {
    continueRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onContinue();
      }
    };
    window.addEventListener("keydown", onKey);
    // `body` alone does not stop the page in Firefox: the scrolling element is <html>.
    const root = document.documentElement;
    const previousRoot = root.style.overflow;
    const previousBody = document.body.style.overflow;
    root.style.overflow = "hidden";
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      root.style.overflow = previousRoot;
      document.body.style.overflow = previousBody;
    };
  }, [onContinue]);

  const heading = startHere?.startHere
    ? startHereHeading({ action: startHere.startHere.action, hostOnly: startHere.hostOnly })
    : null;

  if (!mounted) return null;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label="It's a match"
      data-match-takeover
      className="fixed inset-0 z-50 flex overflow-y-auto bg-background scroll-fade"
    >
      <motion.div
        initial={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.96 }}
        animate={reduced ? { opacity: 1 } : { opacity: 1, scale: 1 }}
        transition={reduced ? { duration: 0.15 } : { type: "spring", damping: 22, stiffness: 260 }}
        className="relative m-auto flex w-full max-w-md flex-col items-center gap-4 px-6 py-8 text-center"
      >
        {/* The celebration the panel had before its chrome went away: a big heart behind the
            headline. Decorative, so it is aria-hidden and fades out rather than shouting. */}
        <motion.div
          aria-hidden
          initial={{ scale: 0 }}
          animate={reduced ? { scale: 1.2 } : { scale: [1.2, 1.35, 1.2] }}
          transition={reduced ? { duration: 0 } : { repeat: Infinity, duration: 2.4, ease: "easeInOut" }}
          className="pointer-events-none absolute -top-16 text-foreground opacity-[0.06]"
        >
          <Heart weight="fill" className="size-72" />
        </motion.div>

        <Heart weight="fill" className="size-12 text-foreground" aria-hidden />

        <h1 className="font-sans text-4xl font-black italic uppercase tracking-tighter text-foreground sm:text-5xl">
          It&apos;s a match!
        </h1>

        <p className="text-balance text-sm text-muted-foreground">
          You and <span className="font-semibold text-foreground">{otherLabel}</span> want to watch{" "}
          <span className="font-semibold text-foreground">{item.Name}</span>
        </p>

        {likedBy.length > 0 && <UserAvatarList users={likedBy} size="lg" />}

        <button
          type="button"
          onClick={onOpenDetails}
          className="aspect-[2/3] h-[min(42svh,384px)] shrink-0 overflow-hidden rounded-2xl border-2 border-border/70 bg-muted shadow-2xl transition-transform active:scale-[0.98]"
          aria-label={`Open details for ${item.Name}`}
        >
          <OptimizedImage
            src={item.ImageTags?.Primary
              ? `/api/media/image/${item.Id}?tag=${item.ImageTags?.Primary}`
              : `/api/media/image/${item.Id}`}
            alt={item.Name}
            externalId={item.Id}
            blurDataURL={item.BlurDataURL}
            className="h-full w-full object-cover"
            height={700}
            width={500}
            sizes="(max-width: 640px) 256px, 256px"
          />
        </button>

        {isSeries && knowsProgress && startHere?.startHere && heading && (
          <div className="w-full border border-border px-4 py-3 text-left">
            <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              {heading}
            </div>
            <div className="text-sm font-medium text-foreground">{startHere.startHere.label}</div>
            {startHere.startHere.warning && (
              <div className="mt-0.5 text-xs text-muted-foreground">{startHere.startHere.warning}</div>
            )}
          </div>
        )}

        <Button ref={continueRef} size="lg" className="mt-1 h-12 w-48 text-lg font-bold" onClick={onContinue}>
          Continue
        </Button>
      </motion.div>
    </div>,
    document.body,
  );
}
