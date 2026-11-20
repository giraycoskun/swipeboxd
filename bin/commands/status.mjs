import { apiGet } from "../lib/http.mjs";
import { bytes, duration } from "../lib/format.mjs";

export const status = {
  summary: "Version, provider, uptime, database",
  async run(ctx) {
    return apiGet(ctx, "/status");
  },
  human(body) {
    const d = body.data;
    const where = d.basePath ? ` · base path ${d.basePath}` : "";
    return [
      `Messer Swipe ${d.version} · ${d.provider} · up ${duration(d.uptimeSeconds)}`,
      `api ${d.apiVersion} · node ${d.node}${where}`,
      `db ${d.database.kind} ${bytes(d.database.sizeBytes)}`,
      `agent ${d.agent.local ? "local" : "remote"} (${d.agent.scope}) as ${d.agent.userName}` +
        (d.agent.hasProviderCredential ? "" : " · no provider credential"),
    ].join("\n");
  },
};
