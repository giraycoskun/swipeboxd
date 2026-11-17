# Contributing

Messer Swipe is published as it is, with **one owner and one roadmap**. Pull requests are not being
accepted — not out of rudeness, but because a patch would have to be maintained against a session model
and four provider integrations that are shaped around one household's use.

What is open, and answered:

| Channel | For | Not for |
|---|---|---|
| [Issues](https://github.com/jakobbjelver/messer-swipe/issues) | a bug with a reproduction: the provider, the step, what you expected | feature requests dressed as bugs |
| [Discussions](https://github.com/jakobbjelver/messer-swipe/discussions) | ideas, provider quirks, "does this work with X" | support for a fork of a fork |
| [`SECURITY.md`](./SECURITY.md) | a vulnerability, privately | anything else |

A bug report that names the provider, the version (`GET /api/version`) and the smallest sequence that
shows it will be fixed. A feature may be built or parked; "no" is a normal answer and it is not a
judgement of the idea.

Forking is welcome and MIT allows it. If you build on this, the parts most worth taking are the session
model (`src/server/session`), the deck query (`src/lib/providers`) and the match rule, not the UI.

## If you are an agent

`AGENTS.md` is the contract, `docs/llms.txt` is the primer, and `npm run check` is the gate. Do not open
a pull request; report the finding instead.
