import assert from "node:assert/strict";
import test from "node:test";
import { artworkUrl, filmUrl, parseFilm, parseWatchlistPage, watchlistUrl, watchlistUrlFromUsername } from "./map";

const base = "https://letterboxd.com/film_buff/watchlist/";

test("builds the public watchlist URL from a username, not a URL or path", () => {
  assert.equal(watchlistUrlFromUsername(" Film_Buff2 "), "https://letterboxd.com/film_buff2/watchlist/");
  for (const value of [undefined, " ", "film/buff", "film%2fbuff", "film?buff", "film#buff", "https://letterboxd.com/film_buff/watchlist/"]) {
    assert.throws(() => watchlistUrlFromUsername(value));
  }
});

test("accepts only public HTTPS Letterboxd watchlist URLs", () => {
  assert.equal(watchlistUrl(" https://www.letterboxd.com/Film_Buff/watchlist "), base);
  for (const url of ["http://letterboxd.com/film_buff/watchlist/", "https://letterboxd.com.attacker.invalid/a/watchlist/",
    "https://letterboxd.com@attacker.invalid/a/watchlist/", "https://letterboxd.com/a/watchlist/page/2/",
    "https://letterboxd.com/a/list/favorites/", "https://letterboxd.com/a/watchlist/?sort=foo"]) {
    assert.throws(() => watchlistUrl(url));
  }
  assert.throws(() => filmUrl("letterboxd:../../watchlist"));
  assert.throws(() => filmUrl("letterboxd:film%2fsecret"));
  assert.equal(artworkUrl("https://a.ltrbxd.com.attacker.invalid/resized/poster.jpg"), undefined);
  assert.equal(artworkUrl("https://a.ltrbxd.com/resized/redirect.svg"), undefined);
});

test("reads only the watchlist grid, decodes titles, and follows only its next page", () => {
  const poster = (slug: string, title: string) => `<li class="griditem"><div data-component-class="LazyPoster" data-item-name='${title}' data-item-slug="${slug}"></div></li>`;
  const html = (next: string) => `<ul>${poster("preview", "Another List (2020)")}</ul>
    <div class="js-watchlist-content" data-num-entries="32"><section class="js-watchlist-main-content">
      <ul>${poster("agnes-amir", "Agnes &amp; Amir (2026)")}${poster("ink-2026", "Ink (2026)")}${poster("agnes-amir", "Duplicate")}</ul>
      <div class="pagination"><a href="${next}" class="next">Older</a></div>
    </section></div>`;

  assert.deepEqual(parseWatchlistPage(html("/film_buff/watchlist/page/2/"), base, 1), {
    entries: [
      { Id: "letterboxd:agnes-amir", Name: "Agnes & Amir", ProductionYear: 2026 },
      { Id: "letterboxd:ink-2026", Name: "Ink", ProductionYear: 2026 },
    ],
    hasMore: true,
  });
  assert.throws(() => parseWatchlistPage(html("https://letterboxd.com/someone-else/watchlist/page/2/"), base, 1), /pagination/);
});

test("distinguishes a confirmed empty watchlist from a private or unexpected page", () => {
  assert.deepEqual(parseWatchlistPage('<div class="js-watchlist-content" data-num-entries="0"><section class="js-watchlist-main-content"></section></div>', base, 1), { entries: [], hasMore: false });
  assert.throws(() => parseWatchlistPage("<h1>This watchlist is private</h1>", base, 1), /public watchlist/);
});

test("reads film detail from public JSON-LD with provider-safe artwork and 10-point ratings", () => {
  const image = "https://a.ltrbxd.com/resized/sm/upload/example.jpg?v=123";
  const id = "letterboxd:i-tonya";
  const item = parseFilm(`<meta property="og:image" content="https://example.invalid/poster.jpg">
    <script type="application/ld+json">{"@type":"Organization","name":"Letterboxd"}</script>
    <script type="application/ld+json">/* <![CDATA[ */
    {"@type":"Movie","name":"I, Tonya","dateCreated":"2017","duration":"PT1H59M","genre":["Drama"],"image":"${image}","aggregateRating":{"ratingValue":3.75}}
    /* ]]> */</script>`, id);
  assert.equal(filmUrl(id), "https://letterboxd.com/film/i-tonya/");
  assert.equal(item.Id, id);
  assert.equal(item.Name, "I, Tonya");
  assert.equal(item.ProductionYear, 2017);
  assert.equal(item.RunTimeTicks, 71_400_000_000);
  assert.equal(item.CommunityRating, 7.5);
  assert.deepEqual(item.Genres, ["Drama"]);
  assert.deepEqual(item.ImageTags, { Primary: image, Backdrop: undefined });
});
