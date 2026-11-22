/**
 * The synopsis, as a provider hands it over, is not always plain text.
 *
 * Jellyfin and Emby keep the description an editor typed, so paragraph breaks arrive as
 * `<br>` and a stray `&amp;` arrives encoded. Rendering that string directly puts the markup
 * on screen — the bug in #105 — and the reporter's screenshots show the fix they expect: the
 * line breaks their library displays, not the tags.
 *
 * Normalising happens where the provider maps the item (once, for every surface: the deck
 * card, the detail sheet, the likes row, the API) rather than at each place that prints it.
 * A provider that already sends clean text (TMDB, Plex) passes through unchanged.
 */

/** Tags a rich-text description can contain. Anything else is left alone: a bare `<` in prose is prose. */
const KNOWN_TAGS = /<\/?(?:b|i|em|strong|u|s|strike|p|div|span|a|ul|ol|li|h[1-6])(?:\s[^>]*)?>/gi;

/** `&amp;` decodes once. Decoding twice would turn a literal "&amp;lt;" into "<". */
const ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  "#39": "'",
};

export function normaliseOverview(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;

  const text = value
    // Line breaks first: they are the formatting the report is about.
    .replace(/<br\s*\/?>/gi, "\n")
    // Block tags end a paragraph; inline tags only decorated one.
    .replace(/<\/?(?:p|div|li|h[1-6])(?:\s[^>]*)?>/gi, "\n")
    .replace(KNOWN_TAGS, "")
    .replace(/&([a-z]+|#\d+);/gi, (match, entity: string) => {
      const decoded = ENTITIES[entity.toLowerCase()];
      return decoded === undefined ? match : decoded;
    })
    // Three or more breaks is a gap in the source, not a layout instruction.
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]+\n/g, "\n")
    .trim();

  return text;
}
