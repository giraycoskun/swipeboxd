"use client";
import { useEffect, useRef } from "react";
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
 * The old panel was a Radix dialog with `max-w-none` around `max-w-sm`: it floated,
 * it had a header the reader never saw, and on a phone it competed with the sheet
 * chrome. This is a plain fixed layer — no blur (a backdrop-filter here is the same
 * Firefox-Android cost that #101 was), no dialog chrome — with its content held to
 * the product's 448 px column so the takeover cannot invent a wide layout.
 */
export function MatchTakeover({ item, sessionCode, onContinue, onOpenDetails }: MatchTakeoverProps) {
  const reduced = useReducedMotion();
  const continueRef = useRef<HTMLButtonElement>(null);

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
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [onContinue]);

  const heading = startHere?.startHere
    ? startHereHeading({ action: startHere.startHere.action, hostOnly: startHere.hostOnly })
    : null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="It's a match"
      data-match-takeover
      className="fixed inset-0 z-50 flex bg-background"
    >
      <motion.div
        initial={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.96 }}
        animate={reduced ? { opacity: 1 } : { opacity: 1, scale: 1 }}
        transition={reduced ? { duration: 0.15 } : { type: "spring", damping: 22, stiffness: 260 }}
        className="mx-auto flex h-full w-full max-w-md flex-col items-center justify-center gap-5 overflow-y-auto px-6 py-10 text-center scroll-fade"
      >
        <Heart weight="fill" className="size-14 text-foreground" aria-hidden />

        <h1 className="font-sans text-4xl font-black italic uppercase tracking-tighter text-foreground">
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
          className="w-36 shrink-0 overflow-hidden rounded-xl border border-border bg-muted transition-transform active:scale-[0.98] sm:w-44"
          aria-label={`Open details for ${item.Name}`}
        >
          <OptimizedImage
            src={item.ImageTags?.Primary
              ? `/api/media/image/${item.Id}?tag=${item.ImageTags?.Primary}`
              : `/api/media/image/${item.Id}`}
            alt={item.Name}
            externalId={item.Id}
            blurDataURL={item.BlurDataURL}
            className="aspect-[2/3] h-full w-full object-cover"
            height={700}
            width={500}
            sizes="(max-width: 640px) 144px, 176px"
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

        <Button ref={continueRef} size="lg" className="mt-2 h-12 w-48 text-lg font-bold" onClick={onContinue}>
          Continue
        </Button>
      </motion.div>
    </div>
  );
}
