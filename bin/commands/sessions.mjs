import { CliError, apiGet } from "../lib/http.mjs";

export const sessions = {
  summary: "Group sessions: list them, or show one by code",
  async run(ctx, rest) {
    const [code] = rest;
    if (!code) return apiGet(ctx, "/sessions");
    return apiGet(ctx, `/sessions/${encodeURIComponent(code.toUpperCase())}`);
  },
  human(body) {
    const d = body.data;
    if (Array.isArray(d.sessions)) {
      if (d.sessions.length === 0) return "no group sessions";
      return d.sessions
        .map((s) => `${s.code}  ${s.members.length} member(s) · ${s.matches} match(es) · ${s.createdAt}`)
        .join("\n");
    }
    const members = d.members.map((m) => `${m.name} (${m.likes} likes)`).join(", ");
    return [`${d.code} · ${d.matches} match(es) · created ${d.createdAt}`, `members: ${members || "none"}`].join("\n");
  },
};

export const session = {
  summary: "Alias for `sessions <code>`",
  async run(ctx, rest) {
    const [code] = rest;
    if (!code) throw new CliError("USAGE", "session needs a code", "swipe session ABCD");
    return apiGet(ctx, `/sessions/${encodeURIComponent(code.toUpperCase())}`);
  },
  human: sessions.human,
};
