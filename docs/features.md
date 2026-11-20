# Features, in detail

The deep dive the README keeps out of the title page: what a session can be tuned to do, and what each
setting changes.

## The deck

The deck is a page of your catalogue minus what you have already swiped. What it draws is a *mode*, set
in the Filter drawer's **Media** section, and every mode is one question:

<details>
<summary><strong>Movies</strong></summary>

Films only. This is the deck the app shipped with, and the default for a library that has no shows.

</details>

<details>
<summary><strong>Shows</strong></summary>

One card per series, with the commitment numbers on it: seasons, episodes, and whether the show is still
running. A series card can be swiped whole (*Whole shows*) or expanded into its episodes (*Single
episodes*), and either can be narrowed to *Continuing*, *Ended*, or *Only what I'm watching*.

</details>

<details>
<summary><strong>Continue</strong></summary>

The next unwatched episode of every show you are in the middle of — one card per show, the question
"what do we watch tonight" answered by where you actually left off.

Continue is only real when the server knows what you have watched. Jellyfin, Emby and Plex do; a TMDB
instance has no progress to read, so the mode says so instead of inventing a position. In a group session
the position shown is the host's, and it is labelled that way.

</details>

<details>
<summary><strong>Episodes</strong></summary>

The unwatched episodes of those same shows — bounded on purpose (five shows, a page of episodes each), so
a library with thousands of episodes cannot stall the deck.

</details>

<details>
<summary><strong>Mixed</strong></summary>

Select both movies and shows in the Media row: the deck interleaves the two rather than running one
catalogue out before the other. There is no "mixed" button because "both" is the whole idea.

</details>

### Starting a show

Opening a show answers the question a synopsis cannot: **where do I start**. The detail sheet carries the
commitment line (seasons · episodes · approximate hours), a start-here panel — *Where to start* for a show
you have not begun, *Where you are* for one you are inside, *The host's position* in a group session where
only the host's progress is knowable — then the seasons, and the episodes inside each one.

### Images and performance

Artwork is fetched through the app, never hot-linked: the request carries a width the media server actually
understands, capped by `MAX_IMAGE_WIDTH` (default `960`), a bounded number are in flight at once
(`IMAGE_CONCURRENCY`), and each has `IMAGE_TIMEOUT_MS` to answer. A timeout is a `504` the card retries —
never a broken image the browser then caches. Episode stills for cards behind the front one are requested
as thumbnails, not posters.

### Spoilers

An episode you have not played is a spoiler waiting to happen: the still, the episode title and the
synopsis each give the plot away. The deck hides all three behind a panel that names only the series and
the episode number, and leaves a **Reveal** on the card. The mask belongs to the card and is not
remembered — the next episode is masked again, and a played episode is never masked.

### When you both say yes

Two members liking the same title is a match, and a match takes the screen: who liked it, the poster (tap
it for the details sheet), and — for a show — where to start. **Continue** or Escape returns you to the
deck. If several matches land while you are reading one, they queue and arrive one after the other instead
of the second overwriting the first.

### Session Settings

When you create a session, customize it for your group:

<details>
<summary><strong>Match Strategies</strong></summary>

- **Two or More**: Any two people liking the same content creates a match
  - Best for: Larger groups where majority rules
  - Finding: Quick results, more options

- **Unanimous**: Everyone must like it for a match
  - Best for: Smaller groups wanting guaranteed crowd-pleasers
  - Finding: Fewer but higher-quality matches
</details>

<details>
<summary><strong>Session Restrictions</strong></summary>

- **Max Likes**: Limit right swipes per person
  - Forces thoughtful, selective choices
  - Prevents mindless approval

- **Max Nopes**: Limit left swipes per person
  - Stops serial negativity
  - Encourages open-mindedness

- **Max Matches**: Auto-stop when you have enough options
  - Perfect for when you just need 3-4 solid picks
</details>

<details>
<summary><strong>Guest Lending (Account Sharing)</strong></summary>

**How it works:**

1. Host enables "Guest Lending" in settings
2. Guest joins session with just a name - no account needed
3. Messer Swipe uses the host's credentials to fetch content
4. Guest gets a unique ID, their swipes are tracked separately
5. Guests cannot access host account or modify settings

**Security note:** Host credentials are stored server-side and encrypted at rest using `AUTH_SECRET` while Guest Lending is enabled. See "Generating `AUTH_SECRET`" in Security & Privacy.

**Perfect for:** Movie nights with friends who don't have media servers
</details>

<details>
<summary><strong>Admin Role</strong></summary>

**Automatically Assigned:** First user to log in for each provider becomes that provider's admin.

**Manual Assignment:** Set `ADMIN_USERNAME` (global) or `[PROVIDER]_ADMIN_USERNAME` (e.g., `JELLYFIN_ADMIN_USERNAME`) environment variables.

**Admin Privileges:**
- Configure included media libraries for the provider
- Manage global provider settings
- Override session restrictions
- Access admin dashboard (only for providers with authentication)
</details>
