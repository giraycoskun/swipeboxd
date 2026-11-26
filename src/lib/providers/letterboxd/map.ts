import { load } from "cheerio/slim";
import type { MediaItem } from "@/types/media";

const ORIGIN = "https://letterboxd.com";
const FILM_ID = /^letterboxd:([a-z0-9]+(?:-[a-z0-9]+)*)$/;

export function watchlistUrlFromUsername(value: string | undefined): string {
  const username = value?.trim() ?? "";
  if (!/^[a-zA-Z0-9_]+$/.test(username)) throw new Error("Invalid Letterboxd username.");
  return `${ORIGIN}/${username.toLowerCase()}/watchlist/`;
}

export function watchlistUrl(value: string | undefined): string {
  const match = /^https:\/\/(?:www\.)?letterboxd\.com\/([a-z0-9_]+)\/watchlist\/?$/i.exec(value?.trim() ?? "");
  if (!match) throw new Error("Set LETTERBOXD_WATCHLIST_URL to https://letterboxd.com/<username>/watchlist/.");
  return watchlistUrlFromUsername(match[1]);
}

export function filmUrl(id: string): string {
  const match = FILM_ID.exec(id);
  if (!match) throw new Error("Invalid Letterboxd film ID.");
  return `${ORIGIN}/film/${match[1]}/`;
}

export function artworkUrl(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  try {
    const url = new URL(value);
    if (url.origin === "https://a.ltrbxd.com" && !url.username && !url.password &&
        /^\/resized\/.*\.(?:jpe?g|png|webp)$/i.test(url.pathname)) {
      return url.href;
    }
  } catch { /* Not a usable artwork URL. */ }
}

export function parseWatchlistPage(html: string, baseUrl: string, page: number) {
  const $ = load(html);
  const watchlist = $(".js-watchlist-content");
  const main = watchlist.find(".js-watchlist-main-content");
  const entries: MediaItem[] = [];
  const seen = new Set<string>();
  main.find('.griditem [data-component-class="LazyPoster"]').each((_, element) => {
    const poster = $(element);
    const id = `letterboxd:${poster.attr("data-item-slug") ?? ""}`;
    const label = poster.attr("data-item-name")?.trim();
    if (!FILM_ID.test(id) || !label || seen.has(id)) return;
    seen.add(id);
    const title = /^(.*) \((\d{4})\)$/.exec(label);
    entries.push({ Id: id, Name: title?.[1] ?? label, ProductionYear: title ? Number(title[2]) : undefined });
  });

  if (!entries.length && !(page === 1 && main.length && watchlist.attr("data-num-entries") === "0")) {
    throw new Error("Letterboxd did not return a public watchlist page. Check that the watchlist is public.");
  }

  // Follow pagination only when the link is the expected next page of this list.
  // The request URL is rebuilt from the configured watchlist, never from page HTML.
  const next = main.find(".pagination a.next").attr("href");
  const nextUrl = `${baseUrl}page/${page + 1}/`;
  const hasMore = next === nextUrl || next === new URL(nextUrl).pathname;
  if (next && !hasMore) throw new Error("Letterboxd returned an unexpected watchlist pagination link.");
  return { entries, hasMore };
}

export function parseFilm(html: string, id: string): MediaItem {
  const $ = load(html);
  const item = $('script[type="application/ld+json"]').toArray().flatMap((node) => {
    try {
      return [JSON.parse($(node).text().replace(/^\s*\/\*\s*<!\[CDATA\[\s*\*\/|\/\*\s*\]\]>\s*\*\/\s*$/g, ""))];
    } catch {
      return [];
    }
  }).find((data) => (data?.["@type"] === "Movie" || data?.["@type"] === "TVSeries") &&
    typeof data.name === "string" && data.name.trim());

  if (!item) throw new Error("Letterboxd did not return film metadata.");
  const year = /^(\d{4})\b/.exec(String(item.dateCreated ?? ""));
  const duration = /^PT(?:(\d+)H)?(?:(\d+)M)?$/.exec(String(item.duration ?? ""));
  const minutes = duration ? Number(duration[1] || 0) * 60 + Number(duration[2] || 0) : 0;
  const rating = item.aggregateRating?.ratingValue;
  const primary = artworkUrl(item.image);
  const backdrop = artworkUrl($('meta[property="og:image"]').attr("content"));

  return {
    Id: id,
    Name: item.name,
    ProductionYear: year ? Number(year[1]) : undefined,
    Overview: typeof item.description === "string" ? item.description : undefined,
    Genres: Array.isArray(item.genre) ? item.genre.filter((genre: unknown) => typeof genre === "string") : undefined,
    RunTimeTicks: minutes ? minutes * 600_000_000 : undefined,
    CommunityRating: typeof rating === "number" && rating >= 0 && rating <= 5 ? rating * 2 : undefined,
    CommunityRatingSource: "Letterboxd",
    ImageTags: { Primary: primary, Backdrop: backdrop !== primary ? backdrop : undefined },
    InLibrary: false,
  };
}
