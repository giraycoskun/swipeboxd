import { MediaItem } from "@/types/media";
import type { Filters } from "@/types/session";
import { deckModeOf } from "@/lib/deck-mode";

interface DeckCacheEntry {
  orderedIds: string[];
  itemsById: Map<string, MediaItem>;
  createdAt: number;
  filtersHash: string;
}

const CACHE_TTL_MS = 20 * 60 * 1000; // 20 minutes

/**
 * How many deck shapes may live at once.
 *
 * The TTL alone was not a bound: an entry was only deleted when someone asked for
 * that exact key again, so a long-lived process with many filter combinations (and
 * any member who keeps changing the drawer) only ever grew. Twelve covers a
 * household's simultaneous shapes with room to spare; the oldest is evicted first.
 * An entry holds up to `DECK_SHORTLIST` (800) items, so twelve is tens of MB, not
 * hundreds.
 */
const MAX_CACHE_ENTRIES = 12;

/** Exported so a test can prove the bound without guessing the constant. */
export const DECK_CACHE_LIMITS = { maxEntries: MAX_CACHE_ENTRIES, ttlMs: CACHE_TTL_MS } as const;

/**
 * Deterministic fingerprint of a filter object: same shape, same order, same key.
 * Exported so a test can prove two deck shapes differ without a database.
 */
export function filtersFingerprint(filters: Record<string, any>): string {
  const sorted = Object.entries(filters)
    .filter(([, value]) => value !== undefined && value !== null)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}:${JSON.stringify(value)}`)
    .join('|');
  let hash = 0;
  for (let i = 0; i < sorted.length; i++) {
    const char = sorted.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash).toString(36);
}

/**
 * Which deck a cache entry belongs to.
 *
 * This has to carry everything that makes the deck a different deck. It did not
 * carry `kinds`/`deckMode`, so switching Movies → Shows inside the TTL found the
 * film deck under the same key and served it — a filter the service ignores is a
 * bug, and so is a cache that ignores one.
 */
export function deckFiltersKey(filters: Filters | null | undefined, extra: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    kinds: filters?.kinds,
    deckMode: deckModeOf(filters),
    showUnit: filters?.showUnit,
    status: filters?.status,
    started: filters?.started,
    sortBy: filters?.sortBy,
    ...extra,
  };
}

export class DeckCacheService {
  private cache: Map<string, DeckCacheEntry> = new Map();

  private generateCacheKey(sessionCode: string, provider: string, filtersHash: string): string {
    return `${sessionCode}:${provider}:${filtersHash}`;
  }

  private generateFiltersHash(filters: Record<string, any>): string {
    return filtersFingerprint(filters);
  }

  private isExpired(entry: DeckCacheEntry): boolean {
    return Date.now() - entry.createdAt > CACHE_TTL_MS;
  }

  /** Number of decks held; a test asserts the bound. */
  get size(): number {
    return this.cache.size;
  }

  /**
   * Drop expired entries, then evict oldest-by-creation until one more fits.
   * Called before every insert, so the cap holds without a background timer.
   */
  private evict(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache) {
      if (now - entry.createdAt > CACHE_TTL_MS) this.cache.delete(key);
    }

    while (this.cache.size >= MAX_CACHE_ENTRIES) {
      let oldestKey: string | null = null;
      let oldestCreatedAt = Number.POSITIVE_INFINITY;
      for (const [key, entry] of this.cache) {
        if (entry.createdAt < oldestCreatedAt) {
          oldestCreatedAt = entry.createdAt;
          oldestKey = key;
        }
      }
      if (oldestKey === null) break;
      this.cache.delete(oldestKey);
    }
  }

  getCachedDeck(
    sessionCode: string,
    provider: string,
    filters: Record<string, any>
  ): { orderedIds: string[]; itemsById: Map<string, MediaItem> } | null {
    const filtersHash = this.generateFiltersHash(filters);
    const cacheKey = this.generateCacheKey(sessionCode, provider, filtersHash);
    const entry = this.cache.get(cacheKey);

    if (!entry || this.isExpired(entry)) {
      if (entry) {
        this.cache.delete(cacheKey);
      }
      return null;
    }

    return {
      orderedIds: entry.orderedIds,
      itemsById: entry.itemsById,
    };
  }

  setCachedDeck(
    sessionCode: string,
    provider: string,
    filters: Record<string, any>,
    orderedIds: string[],
    itemsById: Map<string, MediaItem>
  ): void {
    const filtersHash = this.generateFiltersHash(filters);
    const cacheKey = this.generateCacheKey(sessionCode, provider, filtersHash);

    this.evict();

    this.cache.set(cacheKey, {
      orderedIds,
      itemsById,
      createdAt: Date.now(),
      filtersHash,
    });
  }

  getPaginatedItems(
    sessionCode: string,
    provider: string,
    filters: Record<string, any>,
    excludeIds: Set<string>,
    page: number,
    limit: number
  ): { items: MediaItem[]; hasMore: boolean; totalCount: number } | null {
    const cached = this.getCachedDeck(sessionCode, provider, filters);
    if (!cached) return null;

    const { orderedIds, itemsById } = cached;

    // Filter out excluded IDs and get paginated slice
    const visibleIds: string[] = [];
    for (const id of orderedIds) {
      if (!excludeIds.has(id)) {
        visibleIds.push(id);
      }
    }

    const startIndex = page * limit;
    const endIndex = startIndex + limit;
    const paginatedIds = visibleIds.slice(startIndex, endIndex);

    const items = paginatedIds
      .map(id => itemsById.get(id))
      .filter((item): item is MediaItem => item !== undefined);

    return {
      items,
      hasMore: endIndex < visibleIds.length,
      totalCount: visibleIds.length,
    };
  }

  clearCache(sessionCode?: string): void {
    if (sessionCode) {
      // Clear all entries for this session
      for (const [key] of this.cache) {
        if (key.startsWith(`${sessionCode}:`)) {
          this.cache.delete(key);
        }
      }
    } else {
      // Clear expired entries only
      for (const [key, entry] of this.cache) {
        if (this.isExpired(entry)) {
          this.cache.delete(key);
        }
      }
    }
  }
}

export const deckCache = new DeckCacheService();
