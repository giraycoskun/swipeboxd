"use client";
import { Eye } from "@phosphor-icons/react/dist/ssr";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

/**
 * What an unplayed episode's card shows instead of the still, the episode title and
 * the synopsis.
 *
 * A flat panel, not a blur: a `filter`/`backdrop-filter` inside the dragged element
 * repaints every frame on Firefox Android (#101), and a blur strong enough to hide a
 * still is a blur strong enough to read as a broken image. The card's geometry is the
 * same either way — this is `absolute inset-0` inside it.
 */
export function SpoilerPanel({
  series,
  marker,
  runtime,
  onReveal,
}: {
  series: string;
  marker: string;
  runtime?: string;
  onReveal: () => void;
}) {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 rounded-3xl bg-muted px-8 text-center">
      <Badge variant="meta" className="text-muted-foreground">
        Spoiler hidden
      </Badge>
      <p className="font-sans text-xl font-semibold leading-tight text-foreground">{series}</p>
      <p className="flex items-center gap-2 text-xs text-muted-foreground">
        <span className="font-mono tabular-nums">{marker}</span>
        {runtime && <span aria-hidden>·</span>}
        {runtime && <span className="font-mono tabular-nums">{runtime}</span>}
      </p>
      <p className="max-w-[26ch] text-xs leading-relaxed text-muted-foreground">
        Unplayed — the still, the episode title and the synopsis stay hidden until you ask.
      </p>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="pointer-events-auto mt-1 gap-2 text-[11px] font-semibold uppercase tracking-wider"
        // The card is a drag surface: a press that reaches it would start a swipe
        // and the release would land as a like or a pass.
        onPointerDown={(event) => event.stopPropagation()}
        onPointerUp={(event) => event.stopPropagation()}
        onClick={(event) => {
          event.stopPropagation();
          onReveal();
        }}
      >
        <Eye className="size-3.5" /> Reveal
      </Button>
    </div>
  );
}
