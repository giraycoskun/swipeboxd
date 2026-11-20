---
name: messer-swipe
description: Diagnose and maintain a Messer Swipe instance through its CLI.
---

# Messer Swipe — operating an instance

Use this when someone asks why their Messer Swipe deck is empty, why posters are slow,
what version they run, or how to reset something. The instance ships its own CLI.

## Start here

```bash
docker exec <container> messer-swipe status
docker exec <container> messer-swipe deck --why --limit 5
docker exec <container> messer-swipe libraries
docker exec <container> messer-swipe diag
```

Read `data.version`, `data.provider`, `data.basePath`, `data.database.sizeBytes`, and
`data.agent.hasProviderCredential`. JSON is the default; add `--human` only when a
person will read it.

If the command exits `3`, there is no local token yet: an administrator has to log in
once through the browser. Do not try to create one by hand.

## The questions this answers

- **"The deck is empty."** Status first: is the provider configured and reachable, and
  does the token carry a provider credential? An empty deck with `hasProviderCredential:
  false` is a token problem, not a library problem.
- **"It is slow."** Images are the usual cause. A poster request is capped by
  `MAX_IMAGE_WIDTH` (default 960) and queued; a timed-out image is a `504` the card
  retries, never a broken cached one.
- **"Which version?"** `data.version` — compare with the latest GitHub release before
  suggesting an upgrade.

## Rules

- Never run a write command without the operator's explicit yes.
- Never paste a token into an issue, a chat, or a commit. `msw_…` is a member credential.
- Quote the JSON you based an answer on; do not summarise numbers from memory.
- If a command answers `PROVIDER_AUTH_REQUIRED`, the fix is a browser login by an
  administrator, not a retry.

## Exit codes

`0` ok · `1` failure · `2` usage · `3` auth · `4` not found · `5` provider or network
