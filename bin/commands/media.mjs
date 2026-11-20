import { CliError, apiGet } from "../lib/http.mjs";

export const media = {
  summary: "Search the provider, or show one item by id",
  async run(ctx, rest) {
    const [action, ...args] = rest;

    if (action === "get") {
      if (!args[0]) throw new CliError("USAGE", "media get needs an id", "swipe media get tmdb:movie:550");
      return apiGet(ctx, `/media/${encodeURIComponent(args[0])}`);
    }

    const query = args.join(" ").trim();
    if (!query) throw new CliError("USAGE", "media search needs a query", "swipe media search dune");
    return apiGet(ctx, `/media?query=${encodeURIComponent(query)}`);
  },
  human(body) {
    const d = body.data;
    if (Array.isArray(d.items)) {
      if (d.items.length === 0) return `no matches for "${d.query}"`;
      return d.items
        .map((item) => `${item.name}${item.year ? ` (${item.year})` : ""}  ${item.kind}  ${item.id}`)
        .join("\n");
    }
    return [
      `${d.name}${d.year ? ` (${d.year})` : ""} · ${d.kind} · ${d.rating ?? "no rating"}`,
      `in library: ${d.inLibrary ? "yes" : "no"} · liked: ${d.state.liked ? "yes" : "no"} · hidden: ${d.state.hidden ? "yes" : "no"}`,
      d.watchUrl,
    ].join("\n");
  },
};
