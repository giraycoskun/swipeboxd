import { apiGet } from "../lib/http.mjs";
import { bytes, duration } from "../lib/format.mjs";

export const diag = {
  summary: "A redacted bundle for a bug report (no names, no hostnames)",
  async run(ctx) {
    return apiGet(ctx, "/diag");
  },
  human(body) {
    const d = body.data;
    return [
      `Messer Swipe ${d.version} · ${d.provider} · api ${d.apiVersion} · up ${duration(d.uptimeSeconds)}`,
      `node ${d.node} · base path ${d.basePath || "/"} · db ${d.database.kind} ${bytes(d.database.sizeBytes)}`,
      `libraries: ${d.state.includedIsEverything ? "all included" : `${d.state.includedLibraries} pinned`} · sessions ${d.state.sessions}`,
      `solo swipes: ${d.state.soloLikes} liked, ${d.state.soloHidden} hidden`,
      `images: max ${d.config.maxImageWidth}px, ${d.config.imageConcurrency} at once · tmdb token ${d.config.hasTmdbToken ? "yes" : "no"}`,
    ].join("\n");
  },
};
