import type { MediaItem } from "@/types";

/**
 * Matches arrive one swipe at a time, but a fast group can produce several before
 * the first one is dismissed. Holding a single `matchedItem` silently dropped the
 * second; a queue shows them in the order they landed, once each.
 */
export function enqueueMatch(queue: MediaItem[], item: MediaItem): MediaItem[] {
  return queue.some((queued) => queued.Id === item.Id) ? queue : [...queue, item];
}

export function dequeueMatch(queue: MediaItem[]): MediaItem[] {
  return queue.slice(1);
}
