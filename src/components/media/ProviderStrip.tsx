"use client";

import { Badge } from "@/components/ui/badge";
import { OptimizedImage } from "@/components/ui/optimized-image";
import { useElementWidth } from "@/hooks/use-element-width";
import { cn } from "@/lib/utils";
import { fitProviders, DEFAULT_STRIP_METRICS, type StripMetrics } from "@/lib/provider-strip";
import type { WatchProvider } from "@/types";

interface Props {
  providers: WatchProvider[];
  /** Tile edge in px — the same number the fit is computed from. */
  size?: number;
  gap?: number;
  /** Never render more than this many tiles, however wide the row is. */
  maxVisible?: number;
  className?: string;
  /** Renders nothing when the title has no services. */
  hideWhenEmpty?: boolean;
  /**
   * Available width in px, when the strip lives in a content-sized flex row and
   * cannot measure itself (a deck card's badge row). Omit to measure.
   */
  available?: number;
}

const LOGO_SIZE = 20;

/**
 * A row of service logos that stays legible: fixed-size tiles, and whatever does
 * not fit becomes a "+N" chip.
 *
 * `SourceBadges` (deck card) and `MovieListItem` (likes, matches) share it, so a
 * service row looks the same on a card and in a list, and neither can shrink a
 * logo into a dot.
 */
export function ProviderStrip({
  providers,
  size = LOGO_SIZE,
  gap = 6,
  maxVisible = 10,
  className,
  hideWhenEmpty = false,
  available,
}: Props) {
  const [ref, width] = useElementWidth<HTMLDivElement>();

  const total = providers.length;
  if (total === 0 && hideWhenEmpty) return null;

  const metrics: StripMetrics = { ...DEFAULT_STRIP_METRICS, tile: size, gap };
  const fit = fitProviders(
    available ?? width ?? Number.POSITIVE_INFINITY,
    total,
    metrics
  );
  // `maxVisible` is a ceiling on tiles, not on the count: anything it cuts off is
  // still the user's business, so it lands in the "+N".
  const visible = Math.min(fit.visible, maxVisible);
  const hidden = total - visible;
  const shown = providers.slice(0, visible);

  return (
    <div
      ref={ref}
      className={cn("flex min-w-0 items-center overflow-hidden", className)}
      style={{ gap }}
    >
      {shown.map((provider) => (
        <div
          key={provider.Id}
          className="shrink-0 overflow-hidden rounded-xs border border-border/40"
          style={{ width: size, height: size }}
          title={provider.Name}
          aria-label={provider.Name}
        >
          <OptimizedImage
            src={`https://image.tmdb.org/t/p/w92${provider.LogoPath}`}
            alt={provider.Name}
            unoptimized
            width={size}
            height={size}
            className="size-full object-cover"
          />
        </div>
      ))}
      {hidden > 0 && (
        <Badge
          variant="secondary"
          className="shrink-0 px-1 py-0 font-mono text-[10px] leading-4 tabular-nums"
          title={`${hidden} more service${hidden === 1 ? "" : "s"}`}
        >
          +{hidden}
        </Badge>
      )}
    </div>
  );
}
