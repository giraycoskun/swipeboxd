import { apiGet } from "../lib/http.mjs";

export const deck = {
  summary: "The first cards this token would see, and why there are none",
  async run(ctx, rest, flags) {
    const params = new URLSearchParams();
    if (flags.limit) params.set("limit", String(flags.limit));
    if (flags.why) params.set("why", "1");
    const query = params.toString();
    return apiGet(ctx, `/deck${query ? `?${query}` : ""}`);
  },
  human(body) {
    const d = body.data;
    const lines = [
      `deck ${d.deckMode} (${d.kinds.join(", ")}) · ${d.counts.returned} returned · ${d.counts.swiped} swiped · ${d.libraries.includedIsEverything ? `all ${d.libraries.total}` : `${d.libraries.included}/${d.libraries.total}`} libraries · ${d.provider.durationMs} ms`,
    ];
    for (const entry of d.diagnosis) lines.push(`${entry.severity.toUpperCase()}: ${entry.message}`);
    for (const item of d.items) {
      lines.push(`  ${item.name}${item.year ? ` (${item.year})` : ""}  ${item.kind}  ${item.id}`);
    }
    return lines.join("\n");
  },
};
