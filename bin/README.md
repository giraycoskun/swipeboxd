# `messer-swipe`

The CLI that ships inside the Messer Swipe container.

```bash
docker exec messer-swipe messer-swipe status
docker exec messer-swipe messer-swipe status --human
```

It speaks the instance's `/api/v1` contract with the token the container minted for
itself (`/app/data/.agent-token`, `0600`). Outside the container, point it at a URL
and a token:

```bash
MESSER_SWIPE_URL=https://swipe.example.com \
MESSER_SWIPE_TOKEN=msw_… \
  node bin/messer-swipe.mjs status
```

JSON is the default output; `--human` prints a summary. Exit codes: `0` ok,
`1` failure, `2` usage, `3` auth, `4` not found, `5` provider or network.
