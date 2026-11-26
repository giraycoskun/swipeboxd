# Configuration

Every deployment value, its default, and the one thing it changes. The app reads the environment
first, then the Settings page in the app; nothing here is stored in the repository.

### Provider-Specific Settings

Choose **one** provider setup based on your needs:

<details>
<summary><strong>Jellyfin Setup</strong></summary>

```env
PROVIDER=jellyfin
JELLYFIN_URL=http://your-jellyfin:8096              # Internal URL (required)
JELLYFIN_PUBLIC_URL=https://jellyfin.example.com    # Public URL (optional)
JELLYFIN_USE_WATCHLIST=false                         # Use Watchlist (plugin needed) vs Favorites (optional)
```
</details>

<details>
<summary><strong>Emby Setup (Experimental)</strong></summary>

```env
PROVIDER=emby
EMBY_URL=http://your-emby:8096        # Internal URL (required)
EMBY_PUBLIC_URL=https://emby.example.com  # Public URL (optional)
```
</details>

<details>
<summary><strong>Plex Setup (Experimental)</strong></summary>

```env
PROVIDER=plex
PLEX_URL=http://your-plex:32400       # Internal URL (required)
PLEX_PUBLIC_URL=https://plex.example.com # Public URL (optional)
```
</details>

<details>
  <summary><strong>TMDB Setup (No Server Required)</strong></summary>

```env
PROVIDER=tmdb
TMDB_ACCESS_TOKEN=your-tmdb-token     # API Read-Only Token (required)
TMDB_DEFAULT_REGION=SE                # Default region for availability/certifications (optional)
TMDB_ALLOWED_WATCH_PROVIDERS=netflix,prime,disney  # Limit selectable streaming services (optional)
```
</details>

### Letterboxd watchlist setup

To let users choose their source, set `PROVIDER_LOCK=false` in Compose (under `environment:`) or in
the local `.env`, then restart. On the entry screen, choose **Letterboxd watchlist**, enter a username
such as `giraycoskun`, and enter a display name for Swipeboxd. The app builds the watchlist URL; the
list must be public. Each user can choose a different list. To change sources later, log out and pick
another source. Jellyfin, Emby, Plex, and TMDB keep their existing connection requirements.

To serve one fixed Letterboxd watchlist instead, set:

```env
PROVIDER=letterboxd
PROVIDER_LOCK=true
LETTERBOXD_WATCHLIST_URL=https://letterboxd.com/giraycoskun/watchlist/
```

Enter a display name to start swiping. The deck follows the watchlist's order, reads up to 40 public
pages, and caches watchlist pages for about five minutes. Posters and film details are loaded from
Letterboxd when available. Neither Letterboxd nor TMDB keys are needed. Private watchlists, deck
filters, and writing swipe results back to Letterboxd aren't supported.

### Security & Advanced Options

```env
# Authentication
AUTH_SECRET=random-string-32-chars-min     # Auto-generated on boot/build when not provided. See Security & Privacy.
USE_SECURE_COOKIES=true                    # Required for HTTPS

# Application
PORT=4321                                  # Default port
HOSTNAME=0.0.0.0                          # Bind address
DATABASE_URL=file:/app/data/swiparr.db    # SQLite path or Turso URL
DATABASE_AUTH_TOKEN=your-token            # Required for Turso/Remote DB

# Base path (build-time only — see Custom Base Path section)
# URL_BASE_PATH=/swipe

# Admin
ADMIN_USERNAME=your-username                      # Global auto-grant admin privileges
JELLYFIN_ADMIN_USERNAME=jelly-admin               # Provider-specific admin (overrides global)
PLEX_ADMIN_USERNAME=plex-admin                   # Provider-specific admin (overrides global)
EMBY_ADMIN_USERNAME=emby-admin                   # Provider-specific admin (overrides global)

# Security Headers
X_FRAME_OPTIONS=DENY                       # Frame control
CSP_FRAME_ANCESTORS=none                   # Embedding policy

# Network Safety
ALLOW_PRIVATE_PROVIDER_URLS=false          # Block private/LAN URLs for user-supplied providers (BYOP)
PLEX_IMAGE_ALLOWED_HOSTS=plex.example.com,*.plex.direct  # Optional extra image hosts

# BYOP Mode - Bring Your Own Provider
PROVIDER_LOCK=false                          # Let users choose and configure their own provider

# Misc
ENABLE_DEBUG=false                           # Enable verbose debug logging and client-server error mapping
USE_STATIC_FILTERS=false                     # Skip dynamic filter fetching; use built-in genre/year/rating lists instead (useful for very large libraries where filter API calls time out)

# Images
MAX_IMAGE_WIDTH=960                          # Largest poster width a client may request. Lower it if your media server is slow at resizing (#94)
IMAGE_CONCURRENCY=3                          # How many image fetches may hit the media server at once
IMAGE_TIMEOUT_MS=12000                       # Per-image timeout; a timed-out image answers 504 and the client retries instead of caching a failure
```

### Environment Variable Matrix

| Variable | Required? | Default | Description |
|----------|-----------|---------|-------------|
| `PROVIDER` |  | `jellyfin` | Primary media provider (`jellyfin`, `tmdb`, `plex`, `emby`, `letterboxd`) |
| `PROVIDER_LOCK` |  | `true` | If `true`, users cannot change the provider at runtime |
| `JELLYFIN_URL` |  | - | Internal URL of your Jellyfin server |
| `JELLYFIN_PUBLIC_URL` |  | - | Public URL of your Jellyfin server (for client-side access) |
| `JELLYFIN_USE_WATCHLIST` |  | `false` | Use Jellyfin Watchlist instead of Favorites |
| `EMBY_URL` |  | - | Internal URL of your Emby server |
| `EMBY_PUBLIC_URL` |  | - | Public URL of your Emby server (for client-side access) |
| `PLEX_URL` |  | - | Internal URL of your Plex server |
| `PLEX_PUBLIC_URL` |  | - | Public URL of your Plex server (for client-side access) |
| `PLEX_TOKEN` |  | - | Plex Admin/Access Token |
| `LETTERBOXD_WATCHLIST_URL` | Locked Letterboxd mode | - | Public `https://letterboxd.com/<username>/watchlist/` URL; unlocked users enter a username |
| `TMDB_ACCESS_TOKEN` |  | - | TMDB API Read-Only Access Token |
| `TMDB_DEFAULT_REGION` |  | `SE` | Default TMDB region (ISO 3166-1) for streaming availability/certifications |
| `TMDB_ALLOWED_WATCH_PROVIDERS` |  | - | Comma-separated allowlist of selectable streaming services (case-insensitive substring match, e.g. `netflix,prime,disney,apple tv`). Unset = full TMDB list |
| `AUTH_SECRET` |  | Auto-generated on boot/build | Secret used for session encryption and guest lending token encryption (min 32 chars). See Security & Privacy. |
| `USE_SECURE_COOKIES` |  | `false` | Set to `true` for HTTPS deployments |
| `HIDE_PASSWORD_LOGIN` |  | `false` | Hides the username/password form where the provider offers Quick Connect (Jellyfin), for SSO installs — Jellyfin's SSO plugin behind Authelia, for example. The flag is ignored on Plex, Emby and TMDB, and whenever Quick Connect is unavailable, because the login screen would then have no way in. |
| `DATABASE_URL` |  | `file:/app/data/swiparr.db` | SQLite path or Turso URL [^1] |
| `DATABASE_AUTH_TOKEN`|  | - | Auth token for remote databases (e.g. Turso) |
| `APP_PUBLIC_URL` |  | `swipe.messer.wtf` | The public domain where the app is hosted (drives canonical URLs, OG images, `robots.txt` and secure cookies) |
| `LEGACY_REDIRECT_FROM` |  | - | Comma-separated hostnames that 301 to `APP_PUBLIC_URL`, path preserved (e.g. `old.example.com,www.old.example.com`). Read at build time — change it, redeploy. |
| `URL_BASE_PATH` |  | - | Base path for subpath deployments (e.g. `/swipe`). **Must be set at image build time** — see [Custom Base Path](#custom-base-path). |
| `ADMIN_USERNAME` |  | - | Global admin username (overrides provider-specific) [^2] |
| `JELLYFIN_ADMIN_USERNAME` |  | - | Jellyfin-specific admin username [^2] |
| `EMBY_ADMIN_USERNAME` |  | - | Emby-specific admin username [^2] |
| `PLEX_ADMIN_USERNAME` |  | - | Plex-specific admin username [^2] |
| `X_FRAME_OPTIONS` |  | `DENY` | Security header: X-Frame-Options |
| `CSP_FRAME_ANCESTORS`|  | `none` | Security header: Content-Security-Policy frame-ancestors |
| `ALLOW_PRIVATE_PROVIDER_URLS` |  | `false` | Allow private/LAN provider URLs for BYOP user inputs |
| `PLEX_IMAGE_ALLOWED_HOSTS` |  | - | Extra allowlist for Plex image hosts (comma-separated). `PLEX_URL`/`PLEX_PUBLIC_URL` are allowed by default. |
| `ENABLE_DEBUG` |  | `false` | Enable verbose debug logging and client-server error mapping |
| `USE_STATIC_FILTERS` |  | `false` | Skip dynamic filter fetching and use built-in genre/year/rating lists. Useful for very large libraries where filter API calls time out. |
| `AGENT_API` |  | - | Set to `off` to disable the agent API (`/api/v1/*` and the in-image CLI) without deleting tokens. See [Agents](agents.md). |
| `MAX_IMAGE_WIDTH` |  | `960` | Largest poster width a client may request (160–1920). The deck's CSS width is capped to this before the request leaves the app, and the media server is asked for `maxWidth` (Jellyfin/Emby), a photo transcode (Plex) or a TMDB size — not a raw `width`. Lower it (e.g. `600`) on a server that struggles to resize posters. |
| `IMAGE_CONCURRENCY` |  | `3` | How many image fetches may be in flight against the media server at once. A deck asks for several posters; queueing them keeps each request inside its timeout. |
| `IMAGE_TIMEOUT_MS` |  | `12000` | Per-image timeout. A timed-out image answers `504` with `no-store`, so the browser keeps its placeholder and retries instead of caching a broken card. |

[^1]: Can be set to a local file (internal to container) OR external URL. Mostly relevant for Vercel deployments, which uses the Turso integration in the set-up workflow by default where these values are auto-generated and -injected. Can of course be swapped out with a database service provider of choice.

[^2]: Only applicable for providers with authentication (Jellyfin, Plex, Emby). Admin role ownership is tracked per-provider. Defaults to the first user of that provider that logs in (if supported), or matching env vars. Admin capabilities are disabled for providers without built-in authentication (like TMDB).

 = Required conditionally

## Two provider modes

### Server Lock Mode

>PROVIDER_LOCK=true

**One provider, admin-controlled**

- Admin configures ONE provider in environment variables
- All users automatically use this provider
- Best for: Families, roommates, shared media servers

### BYOP Mode

>PROVIDER_LOCK=false

**Bring Your Own Provider**

- Each user connects their own provider during onboarding
- Users can switch providers anytime
- Best for: Users with different media servers, and/or you have none
