# Agents

Messer Swipe can be driven by an agent — yours, or one you point at it later. The
surface is a CLI that ships inside the container and a small JSON API behind it.
No plugin, no protocol handshake, no separate service.

## The one command

```bash
docker exec messer-swipe messer-swipe status
```

That is the whole setup. The container mints a **local agent token** the first time an
administrator logs in, writes it beside the database (`/app/data/.agent-token`, `0600`),
and the CLI picks it up automatically. Nothing to copy, nothing to configure.

```bash
docker exec messer-swipe messer-swipe status --human
```

`--human` prints a summary; without it you get JSON, because the caller is usually an
agent.

## From outside the container

An agent that is not on the Docker host — a bot in another container, a laptop, a
scheduled job on another machine — uses the same API over HTTP with its own token:

```bash
MESSER_SWIPE_URL=https://swipe.example.com \
MESSER_SWIPE_TOKEN=msw_… \
  node /path/to/bin/messer-swipe.mjs status
```

Tokens are created in **Settings → Agents** (administrators only). The plaintext is
shown once. Scopes:

| Scope | May |
|---|---|
| `read` | read status, libraries, decks, sessions, logs |
| `write` | `read`, plus reversible changes (settings, cache) |
| `admin` | `write`, plus destructive changes and token management |

A token acts as the member who created it. Revoking is instant: the row is marked
revoked, the audit trail stays.

## What a token is worth

A token is a member's credential, not a second permission system. It can read what that
member can read and change what that member can change — so treat `msw_…` like a session
cookie, and prefer `read` unless the agent genuinely needs to write.

The local token is minted for the administrator and carries that administrator's
provider credential (encrypted with the instance's auth secret) so that provider-backed
answers — a deck preview, a library list — work without a browser. If you would rather
not store that, revoke the local token in Settings → Agents; the container will not
mint another until an administrator logs in again, and the provider-backed commands
will answer `PROVIDER_AUTH_REQUIRED`.

## The contract

- `GET /api/v1/status` — version, provider, uptime, database, and which token is asking.
- Every response is `{ ok, api, data, meta }` or `{ ok, api, error: { code, message, hint } }`.
- `api` is the contract version. A client that does not understand it should refuse to
  guess rather than parse optimistically.
- Exit codes: `0` ok, `1` failure, `2` usage, `3` auth, `4` not found, `5` provider or
  network. Branch on the code, not on the message.

## Turning it off

`AGENT_API=off` makes `/api/v1/*` answer `404` with `AGENT_API_DISABLED`. It does not
delete tokens; unset it to turn the surface back on.
