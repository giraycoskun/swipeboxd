import { apiGet } from "../lib/http.mjs";

export const logs = {
  summary: "The tail of the process log (credentials already scrubbed)",
  async run(ctx, rest, flags) {
    const params = new URLSearchParams();
    if (flags.level) params.set("level", String(flags.level));
    if (flags.since) params.set("since", String(flags.since));
    if (flags.limit) params.set("limit", String(flags.limit));
    const query = params.toString();
    return apiGet(ctx, `/logs${query ? `?${query}` : ""}`);
  },
  human(body) {
    const d = body.data;
    if (d.entries.length === 0) return `no ${d.level === "all" ? "" : `${d.level} `}lines in the last ${d.sinceMinutes} minutes`;
    return d.entries.map((entry) => `${entry.at} ${entry.level.toUpperCase().padEnd(5)} ${entry.message}`).join("\n");
  },
};
