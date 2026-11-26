import "server-only";
import axios from "axios";
import sharp from "sharp";
import { cacheLife } from "next/cache";
import { config } from "@/lib/config";
import { mapWithConcurrency } from "@/lib/concurrency";
import { createSemaphore } from "@/lib/semaphore";
import type { MediaItem } from "@/types/media";
import { PROVIDER_CAPABILITIES, ProviderType, type AuthContext, type MediaProvider, type SearchFilters } from "../types";
import { artworkUrl, filmUrl, parseFilm, parseWatchlistPage, watchlistUrl } from "./map";

const MAX_WATCHLIST_PAGES = 40;
const requests = createSemaphore(4);
const http = axios.create({ timeout: 8_000, maxRedirects: 0 });

async function publicPage(url: string) {
  const response = await requests.run(() => http.get<string>(url, {
    responseType: "text",
    maxContentLength: 2 * 1024 * 1024,
    signal: AbortSignal.timeout(8_000),
  }));
  return response.data;
}

async function readWatchlistPage(url: string, page: number) {
  "use cache";
  cacheLife({ stale: 0, revalidate: 300, expire: 1800 });
  return parseWatchlistPage(await publicPage(page === 1 ? url : `${url}page/${page}/`), url, page);
}

async function readFilm(id: string) {
  "use cache";
  cacheLife("days");
  return parseFilm(await publicPage(filmUrl(id)), id);
}

export class LetterboxdProvider implements MediaProvider {
  readonly name = ProviderType.LETTERBOXD;
  readonly capabilities = PROVIDER_CAPABILITIES[ProviderType.LETTERBOXD];

  async authenticate(username: string) {
    return { id: `letterboxd-${crypto.randomUUID()}`, name: username, accessToken: null };
  }

  async getItems(filters: SearchFilters, auth: AuthContext = {}) {
    const limit = Math.min(50, Math.max(1, filters.limit || 20));
    return (await this.getDeckPage(filters.offset || 0, limit, new Set(), auth, filters.searchTerm)).items;
  }

  async getDeckPage(offset: number, limit: number, excluded: ReadonlySet<string>, auth: AuthContext, searchTerm?: string) {
    const url = watchlistUrl(config.app.providerLock ? config.LETTERBOXD_WATCHLIST_URL : auth.watchlistUrl);
    const entries = new Map<string, MediaItem>();
    const query = searchTerm?.trim().toLowerCase();
    let more = false;
    for (let page = 1; page <= MAX_WATCHLIST_PAGES; page++) {
      const result = await readWatchlistPage(url, page);
      for (const item of result.entries) {
        if (!query || item.Name.toLowerCase().includes(query)) entries.set(item.Id, item);
      }
      more = result.hasMore && page < MAX_WATCHLIST_PAGES;
      if (!more || entries.size > offset + limit) break;
    }

    // Window the stable upstream order, then remove swiped items. Removing them
    // before taking the offset would skip unseen titles as swipes arrive.
    const ordered = [...entries.values()];
    const window = ordered.slice(offset, offset + limit).filter((item) => !excluded.has(item.Id));
    const items = await mapWithConcurrency(window, 4, async (entry) => {
      try {
        const film = await readFilm(entry.Id);
        return { ...film, ProductionYear: entry.ProductionYear ?? film.ProductionYear };
      } catch {
        // A film can be removed or temporarily unavailable independently of the list.
        return entry;
      }
    });
    return { items, hasMore: more || ordered.slice(offset + limit).some((item) => !excluded.has(item.Id)) };
  }

  getItemDetails(id: string) { return readFilm(id); }

  async getGenres() { return []; }
  async getYears() { return []; }
  async getRatings() { return []; }
  async getLibraries() { return []; }

  getImageUrl(_id: string, _type: string, tag?: string) { return artworkUrl(tag) ?? ""; }
  async getBlurDataUrl() { return ""; }

  async fetchImage(id: string, type: string, _tag?: string, _auth?: AuthContext, options?: Record<string, string>) {
    const isArtwork = type === "Primary" || type === "Backdrop";
    const url = isArtwork ? (await readFilm(id)).ImageTags?.[type] : undefined;
    if (!url) throw Object.assign(new Error("Letterboxd artwork not found."), { response: { status: 404 } });
    const response = await http.get<ArrayBuffer>(url, {
      responseType: "arraybuffer",
      maxContentLength: 5 * 1024 * 1024,
      signal: AbortSignal.timeout(8_000),
    });
    if (!/^image\/(?:jpeg|png|webp)(?:;|$)/i.test(String(response.headers["content-type"]))) {
      throw new Error("Letterboxd did not return an image.");
    }
    const data = await sharp(Buffer.from(response.data), { limitInputPixels: 12_000_000 })
      .resize({ width: Number(options?.width) || 600, withoutEnlargement: true })
      .webp({ quality: Number(options?.quality) || 75 }).toBuffer();
    return { data, contentType: "image/webp" };
  }
}
