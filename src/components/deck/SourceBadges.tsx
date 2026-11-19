"use client";
import React from "react";

import { MediaItem } from "@/types";
import { Badge } from "@/components/ui/badge";
import {
  HardDrives,
} from "@phosphor-icons/react/dist/ssr";
import { ProviderStrip } from "@/components/media/ProviderStrip";

const MAX_VISIBLE_LOGOS = 4;

/**
 * Source row for hybrid decks: a library chip when the title is on the
 * user's media server, plus streaming service logos where it's watchable.
 *
 * The logos are the shared `ProviderStrip`, so a deck card and a likes row agree
 * on tile size and on what "+N" means.
 */
export function SourceBadges({ item }: { item: MediaItem }) {
  const watchProviders = item.WatchProviders || [];
  if (!item.InLibrary && watchProviders.length === 0) return null;

  return (
    <>
      {item.InLibrary && (
        <Badge
          variant="secondary"
          className="gap-1 bg-neutral-600/70 hover:bg-accent text-neutral-100 border-0"
        >
          <HardDrives className="w-3 h-3 mb-px" />
          Library
        </Badge>
      )}
      {watchProviders.length > 0 && (
        // Four 20 px tiles and the gap between them, plus the "+N" chip's slot: the
        // card's badge row is content-sized, so the strip is told how much room it has.
        <ProviderStrip
          providers={watchProviders}
          maxVisible={MAX_VISIBLE_LOGOS}
          available={MAX_VISIBLE_LOGOS * 24 + 42}
          gap={4}
        />
      )}
    </>
  );
}
