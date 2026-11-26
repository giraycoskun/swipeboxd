# AGENTS.md — Swipeboxd

Agent contract for this repo. The product is **Swipeboxd**: a personal fork of
**Messer Swipe** — a swipe deck over a Jellyfin, Emby, Plex, TMDB or Letterboxd
watchlist library. This fork exists for Giray's own viewing: the upstream's
server estate, demo host and release automation do not run here, but the
upstream architecture is kept intact so `master` can always be fast-forwarded
from `jakobbjelver/messer-swipe`.

## What this is

The same single-user-ish Next.js app as upstream, with fork additions that stay
inside upstream's provider contract:

- a **data source picker** at sign-in when the provider is not locked;
- a **Letterboxd watchlist** provider that needs only a public watchlist
  username — no Letterboxd or TMDB key;
- a **movie avatar collection** instead of profile-picture uploads.

One repo, one image built from this Dockerfile (the compose example still shows
upstream's registry), one stack.

## Read first

| File | Why |
|---|---|
| `MESSER.md` | UI adoption record: brand, canon version, deviations |
| `.github/CONTRIBUTING.md` | commit conventions (conventional commits) |
| `AGENTS.md` (this file) | invariants and commands |
| `docs/configuration.md` | setup, including Letterboxd watchlist mode |
| `docs/maintaining.md` | the maintenance engine (upstream doc; sensors and applier) |

`PROJECT.yaml` and `skills/messer-swipe/SKILL.md` describe the **upstream**
estate (deploy host, image registry, service paths). Read them for provider
traps and verification recipes, but their host facts are not this fork's.

## Layout

```
src/app/            routes: deck (/), login, /ui sink, /healthz, /readyz, api/*
src/components/     deck, movie, shows, session, likes, settings, ui (shadcn atoms, local)
src/lib/providers/  jellyfin | emby | plex | tmdb | letterboxd + factory, item-source, mappers
                    (map.ts is provider-free on purpose: unit tests import it)
src/lib/services/   media-service (deck assembly), session-service, auth-service
src/lib/            pure helpers with their own *.test.ts siblings
src/db/             drizzle schema + generated SQL migrations (src/db/migrations)
src/styles/messer/  generated canon files — never edited by hand
```

## Commands

```bash
npm ci                     # install (lockfile committed; Node 24+)
npm run dev                # next dev on :3000 (needs a host-reachable JELLYFIN_URL)
npm run build              # migrations + next build
npm run lint               # eslint .
npm run typecheck          # tsc --noEmit  (authoritative; the patch tool's lint is not)
npm test                   # node --import tsx --test "src/**/*.test.ts"
npm run check              # lint + typecheck + test — run before every commit
npm run doctor             # env, provider reachability, db, version
npm run e2e                # UI contract on a running instance (needs E2E_BASE_URL, defaults :3000)
npm run db:migrate         # apply migrations (tsx)
npm run db:generate        # new migration from schema changes
```

A Letterboxd-only instance runs with `PROVIDER=jellyfin PROVIDER_LOCK=false`
and no provider credentials: pick "Letterboxd watchlist" at sign-in and enter a
public watchlist username.

## Invariants

1. **`MediaItem.Kind` absent means movie.** Read it with `itemKind()`; never `?? "movie"` inline.
2. **`src/lib/providers/item-source.ts` is the only parser of typed ids** (`tmdb:movie:`, `tmdb:tv:`).
   For `getItemDetails` pass `detailsIdFor(id, providerType)`: TMDB needs the prefixed id, every other
   provider the bare one. Stripping first resolves a series to the film that shares its numeric id.
3. **A provider declares a capability only when its adapter exists.** `hasSeries`, `hasSeasons`,
   `hasProgress`, `hasNextUp` gate deck modes; a premature `true` renders an empty deck with no error.
   Letterboxd runs with every capability `false` on purpose.
4. **`deckMode` is derived, filter chips are not.** Storage carries `deckMode` + `kinds`; read them
   through `deckModeOf()` / `withDeckDefaults()` (`src/lib/deck-mode.ts`).
5. **Every provider is reachable only through the factory**, and the session's provider is the source
   of truth — never a client-supplied URL or provider.
6. **`src/proxy.ts` is the only middleware.** All request-level logic (CSP, auth, base-path rewrites)
   lives there; `next.config.ts` `headers()` is build-time and runs after the middleware.
7. **Mono is for machine values.** Badges use the `meta` variant; see `MESSER.md`.
8. **Icons are Phosphor** (`@phosphor-icons/react/dist/ssr`), `weight="fill"` only for state. The
   swipe mark is `CardsThree` turned 270° (`mark.rotate` in messer-ui, `rotate-[270deg]` here) so the
   cards stand up with the thin ones on the left; the tab glyph uses the same turn.
9. **A new provider mapper is a pure function** in a `map.ts` with no axios/Next import, so it is
   testable without a runtime.
10. **Tests are `node:test`.** Do not add vitest/jest; the lockfile cost is not worth it.
11. **An image request carries a size the provider understands.** `imageQueryFor()`
    (`src/lib/image-request.ts`) is the only place that knows a provider's dialect — Jellyfin/Emby
    `maxWidth`, Plex's photo transcoder, TMDB's path segment — and the route forwards nothing a client
    sends unfiltered. A raw `width` is ignored by Jellyfin, which then re-encodes the original
    2000×3000 poster per card, and ignored by Plex's `/thumb`, which serves it whole (issue #94).
    `MAX_IMAGE_WIDTH` (default 960) caps what any client may ask for.
12. **A deck fetch never asks a provider for `Episode`.** A card is a show: `deckFetchKinds()` maps
    `episode`/`season` → `series` before any whole-library fetch, and the episodes deck is the
    bounded set of unwatched episodes of the shows you are watching, not a scan of the library.
13. **The agent surface is `/api/v1`, and it calls services — never the app's own HTTP API.** Every
    handler is wrapped in `agentRoute(scope, action, …)` from `src/lib/agent/route.ts`, which owns the
    bearer check, the envelope and the audit row; `bin/messer-swipe.mjs` is the only client shipped
    here, and the token it uses is minted by the container at first admin login. The UI's `/api/*`
    stays private; a new capability means a new `/api/v1` handler, not a second implementation.
14. **The Letterboxd source reads only the public watchlist grid.** The URL is built only by
    `watchlistUrlFromUsername()` and validated by `watchlistUrl()` (`src/lib/providers/letterboxd/map.ts`),
    through `assertSafeUrl`; it follows only the watchlist's own next page and never accepts a
    client-supplied Letterboxd URL.
15. **Profile pictures are catalog avatars, not uploads.** `/api/user/profile-picture` accepts only
    JSON `{ avatarId }` from `MOVIE_AVATAR_IDS` (`src/lib/movie-avatars.ts`) and rasterises that known
    SVG itself; multipart is refused with 415, unknown ids with 400, and a legacy base64 field is
    stripped by Zod before it can reach the database.

## Working rules

- Commits follow `.github/CONTRIBUTING.md` (conventional commits). `feat:`/`fix:` on `master` are
  what this fork's manual releases are cut from; iterations on a feature branch use `chore:` or
  `refactor:`.
- Branch: `dev` is the working branch, `master` releases, features branch off `dev`. Never commit to
  `master` by hand. Commits are the owner's (Giray) or the assistant identity — never upstream
  authorship; the "commit as Jakob" rule belongs to upstream, whose Vercel build it serves.
- **Syncing with upstream:** fast-forward `master` from `jakobbjelver/messer-swipe`, rebase `dev`
  onto it, and compare diffs before pushing to the fork. Fork additions (data source picker,
  Letterboxd provider, avatars, this file) must keep upstream's contracts so the merge stays clean.
- After changing a provider or the deck service, prove it through `/api/media/items` — a helper
  having a test is not evidence the deck uses it.
- **UI changes are proven with `npm run e2e`**, which answers the media API from fixtures and asserts
  the things a unit test cannot see (a rating rendered once, a switch whose knob is the paper colour,
  a whole row that toggles, a sheet with no shadow). It writes screenshots to `e2e/shots/`. A visual
  fix reported without this is a guess.
- Never accept a credential in chat; ask for a revocable token.

## Where the depth is

- **Project skill `skills/messer-swipe/SKILL.md`** — provider traps, deploy and release flow, live
  verification recipes (written for upstream; the traps transfer, the hosts do not).
- `MESSER.md` — UI deviations with dates and exits.
- `docs/configuration.md` — Letterboxd watchlist setup and every provider's env vars.
- `docs/maintaining.md` — the maintenance engine (sensors, brief, approval, applier).
