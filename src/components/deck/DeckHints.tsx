"use client";
import { useEffect, useState } from "react";
import { Kbd } from "@/components/ui/kbd";

/**
 * The deck's keys, shown only after someone has actually used one.
 *
 * A permanent row of shortcuts is decoration at rest — and on a phone, where there
 * is no keyboard, it is a lie. So: `hidden sm:flex`, opacity-only (no layout shift,
 * so the 390 px screen stays byte-identical), four seconds after the first key press.
 * The full table stays in Settings → Guide.
 */
const HINTS = [
  { label: "Like", keys: ["→", "D"] },
  { label: "Pass", keys: ["←", "A"] },
  { label: "Undo", keys: ["R"] },
  { label: "Details", keys: ["⏎"] },
  { label: "Filters", keys: ["F"] },
] as const;

export function DeckHints() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    let timer: number | undefined;
    const onKey = (event: KeyboardEvent) => {
      // A browser shortcut is not deck input.
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      setVisible(true);
      window.clearTimeout(timer);
      timer = window.setTimeout(() => setVisible(false), 4000);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.clearTimeout(timer);
    };
  }, []);

  return (
    <div
      data-deck-hints
      aria-hidden
      className={`hidden sm:flex flex-wrap items-center justify-center gap-x-4 gap-y-1 px-2 transition-opacity duration-300 ${
        visible ? "opacity-100" : "opacity-0 pointer-events-none"
      }`}
    >
      {HINTS.map((hint) => (
        <span key={hint.label} className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
          {hint.label}
          {hint.keys.map((key) => (
            <Kbd key={key}>{key}</Kbd>
          ))}
        </span>
      ))}
    </div>
  );
}
