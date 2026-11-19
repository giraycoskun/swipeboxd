"use client";

import { useState, type ReactNode } from "react";
import { CaretDown } from "@phosphor-icons/react/dist/ssr";

import { cn } from "@/lib/utils";

interface Props {
  /** How many items the list holds — the fold only appears above `threshold`. */
  count: number;
  /** Past this many items the list opens folded. */
  threshold: number;
  /** Height of the folded window, e.g. "9.7rem" for three rows and a sliver of the fourth. */
  foldedHeight: string;
  /** Singular noun for the toggle: "season" → "See all 5 seasons". */
  noun: string;
  /** The parent opened something inside the list; do not fold it away again. */
  forceOpen?: boolean;
  className?: string;
  buttonClassName?: string;
  children: ReactNode;
}

/**
 * A long list in a sheet: a fixed-height window with the canon fade, and a
 * "See all N …" toggle. Shows the whole list under the threshold, so a three-season
 * show never grows a control it does not need.
 *
 * Shared by the season list and the "Available on" services row — the two places
 * that can hold fifty rows in a half-screen sheet.
 */
export function FoldableList({
  count,
  threshold,
  foldedHeight,
  noun,
  forceOpen = false,
  className,
  buttonClassName,
  children,
}: Props) {
  const [open, setOpen] = useState(false);
  const expanded = open || forceOpen;
  const folded = !expanded && count > threshold;

  return (
    <>
      <div
        className={cn(folded && "overflow-y-auto scroll-fade", className)}
        style={folded ? { maxHeight: foldedHeight } : undefined}
      >
        {children}
        {/* The fade covers the sliver of the next row; the padding keeps the last row
            reachable under the mask when the window scrolls. */}
        {folded && <div className="h-10" aria-hidden />}
      </div>

      {count > threshold && (
        <button
          type="button"
          className={cn(
            "mt-3 flex w-full items-center justify-center gap-1.5 py-2 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground",
            buttonClassName
          )}
          onClick={() => setOpen((value) => !value)}
          aria-expanded={expanded}
        >
          {expanded ? "See less" : `See all ${count} ${count === 1 ? noun : `${noun}s`}`}
          <CaretDown className={cn("size-3.5 transition-transform", expanded && "rotate-180")} />
        </button>
      )}
    </>
  );
}
