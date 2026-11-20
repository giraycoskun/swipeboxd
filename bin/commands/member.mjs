import { CliError, apiGet } from "../lib/http.mjs";

export const member = {
  summary: "One member's solo swipes and session memberships",
  async run(ctx, rest) {
    const [id] = rest;
    if (!id) throw new CliError("USAGE", "member needs an id", "swipe member <userId>");
    return apiGet(ctx, `/members/${encodeURIComponent(id)}`);
  },
  human(body) {
    const d = body.data;
    return [
      `${d.name ?? d.userId}`,
      `solo: ${d.solo.liked} liked · ${d.solo.hidden} hidden · last swipe ${d.lastSwipeAt ?? "never"}`,
      `sessions: ${d.sessions.length === 0 ? "none" : d.sessions.map((s) => s.code).join(", ")}`,
    ].join("\n");
  },
};
