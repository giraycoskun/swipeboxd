# Features, in detail

The deep dive the README keeps out of the title page: what a session can be tuned to do, and what each
setting changes.

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
