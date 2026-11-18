# Upgrading to 2.0

2.0 is the show release. The deck can draw series — whole, or episode by episode — and three things you
used to do by hand are now deck modes: choosing between films and shows, finding where to start a show,
and continuing one you are already in the middle of.

Nothing you own has to be renamed, and there is nothing to run by hand on Docker. Three things do change,
and one of them rewrites stored ids.

## What happens on first boot

| | |
|---|---|
| **Schema** | `Like` and `Hidden` gain a `kind` column, and both unique indexes now include it. Applied automatically — the container runs `node src/db/migrate.js` before it starts. A bare-metal install runs `npm run db:migrate`. |
| **Your swipes** | Kept. Existing rows read as `kind = 'movie'`, which is what they were. |
| **Sessions** | Kept, including matches and members. |
| **Saved filters** | Kept, but re-interpreted — see below. |
| **Media library** | Untouched. The app only reads from your server. |
| **TMDB ids** | Rewritten once, on a `PROVIDER=tmdb` install — see below. |

## The one data change: TMDB ids are typed

In 1.x a TMDB like was stored as the bare number TMDB returned. TMDB uses the same number for a film and
a show — id `57243` is both — so 2.0 stores the kind in the id: `tmdb:movie:57243`, `tmdb:tv:57243`.
Without the rewrite, every film you already swiped in TMDB mode would look new and come back in the deck.

The migration runs once, at boot, and only when **all** of these hold:

1. `PROVIDER=tmdb` — Jellyfin/Emby ids are GUIDs and Plex rating keys are *also* bare numbers, so an
   unconditional rewrite would turn a Plex library's likes into TMDB ids.
2. Every `Session` in the database was written by TMDB. A database that has ever run under another
   provider keeps its ids exactly as they are.
3. The row is numeric and nothing else (no letters, no colon), and no already-typed row would collide
   with it.

You will see the count in the container log:

```
[2.0] Prefixed 97 legacy TMDB id(s) in Like.
[2.0] Prefixed 12 legacy TMDB id(s) in Hidden.
```

If it declines, it says why and changes nothing:

```
[2.0] Skipping legacy TMDB id prefixing: this database carries sessions from jellyfin (3).
  Bare numeric ids here may be that provider's, not TMDB's.
```

That message means the database is not a pure TMDB install. Leave it alone: nothing is lost, but a TMDB
install sharing that file should get its own database (or a restore from a copy taken while it was TMDB-only).

**Rollback is a restore, not just a tag.** Pin the previous image tag *and* keep the copy of the SQLite
file you took before upgrading: a 1.x build cannot resolve `tmdb:movie:<id>` rows, so swapping the image
back alone leaves those likes stranded. Docker: `docker stop messer-swipe && cp -a <data>/swiparr.db
<somewhere>` before you pull — the file is `swiparr.db` in the mounted `/app/data`.

## Behaviour you will notice

- **Deck modes.** The Filter drawer's *Media* section is `Movies | Shows`; both selected is the mixed
  deck. Under Shows, a second row decides what one card is (*Whole shows* or *Single episodes*) and what
  to narrow to (*Continuing | Ended | Only what I'm watching*).
- **A "films only" filter you never chose becomes both kinds.** The 1.x drawer wrote `kinds: ["movie"]`
  whenever nothing else was selected — a default, not a decision. On a server that has shows, that object
  now opens as the mixed deck. Picking Movies explicitly is honoured from then on.
- **Continue and single episodes need watched state.** They are real on Jellyfin, Emby and Plex; a TMDB
  instance has no progress to know, so those modes render an honest empty state rather than a guess.
  In a group session the progress shown is the host's, and it says so.
- **An episode card is the episode.** Its title is the episode's, its chip is the position (`S2 · E4`),
  and the show's detail sheet answers "where do I start" with a season and an episode instead of a
  synopsis.
- **Images are sized by the app.** Every poster request carries a width the media server understands,
  capped by `MAX_IMAGE_WIDTH` (default `960`). A slow server no longer makes the deck look broken: at most
  `IMAGE_CONCURRENCY` fetches are in flight, each has `IMAGE_TIMEOUT_MS` to answer, and a timeout is a
  `504` the card retries instead of a broken image it keeps.
- **The episodes deck is scoped.** It offers the unwatched episodes of the shows you are actually
  watching, not a scan of the library.

## New environment variables

| Variable | Default | |
|---|---|---|
| `MAX_IMAGE_WIDTH` | `960` | Largest poster a client may ask for (160–1920). Lower it (`600`) if your server struggles to resize artwork. |
| `IMAGE_CONCURRENCY` | `3` | Fetches allowed against the media server at once. |
| `IMAGE_TIMEOUT_MS` | `12000` | Per-image timeout; the card retries. |

Nothing else is required. The full matrix is in [configuration.md](configuration.md).

## What 2.0 deliberately does not include

Per-guest progress (the group sees the host's position), anime absolute numbering, season-level streaming
availability, a chat layer, and translations. The deck speaks English.

## Still on 1.x?

Nothing above is blocking: every release from 1.7.0 on has the new name and the new image path, and the
legacy hostnames redirect. 2.0 is the release that adds shows; upgrade when you can take a copy of the
database first.
