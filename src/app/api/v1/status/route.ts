import { statSync } from "node:fs";

import { agentRoute } from "@/lib/agent/route";
import { API_VERSION } from "@/lib/agent/envelope";
import { config } from "@/lib/config";
import { getEffectiveCapabilities } from "@/lib/runtime-config";
import { ProviderType } from "@/lib/providers/types";

/** Size of the SQLite file, when this instance has one. Never the path: an agent
 *  does not need the host's layout, and `diag` is the redacted way to ask. */
function databaseInfo() {
  const url = config.db.url ?? "";
  if (!url.startsWith("file:")) return { kind: "remote" as const, sizeBytes: null as number | null };
  try {
    return { kind: "sqlite" as const, sizeBytes: statSync(url.slice("file:".length)).size as number | null };
  } catch {
    return { kind: "sqlite" as const, sizeBytes: null as number | null };
  }
}

export const GET = agentRoute("read", "status", async (ctx) => {
  const provider = config.app.provider as ProviderType;
  return {
    version: config.app.version,
    apiVersion: API_VERSION,
    provider,
    capabilities: getEffectiveCapabilities(provider),
    basePath: config.app.basePath,
    uptimeSeconds: Math.round(process.uptime()),
    node: process.version,
    database: databaseInfo(),
    agent: {
      name: ctx.token.name,
      scope: ctx.scope,
      userName: ctx.token.userName,
      local: ctx.token.isLocal,
      hasProviderCredential: ctx.session !== null,
    },
    serverTime: new Date().toISOString(),
  };
});
