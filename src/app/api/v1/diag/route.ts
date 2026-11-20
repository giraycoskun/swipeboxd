import { statSync } from "node:fs";
import { and, eq, isNull, sql } from "drizzle-orm";

import { agentRoute } from "@/lib/agent/route";
import { API_VERSION } from "@/lib/agent/envelope";
import { db } from "@/lib/db";
import { hiddens, likes, sessions } from "@/db/schema";
import { config } from "@/lib/config";
import { getEffectiveCapabilities } from "@/lib/runtime-config";
import { ConfigService } from "@/lib/services/config-service";
import { ProviderType } from "@/lib/providers/types";

/**
 * A bundle a reporter can paste into an issue. Counts, flags and versions only:
 * no library names, no titles, no hostnames, no ids. `swipe diag > diag.json`
 * is the intended use, and the redaction is the point.
 */
export const GET = agentRoute("read", "diag", async (ctx) => {
  const provider = config.app.provider as ProviderType;
  const capabilities = getEffectiveCapabilities(provider);

  const dbUrl = config.db.url ?? "";
  let dbSize: number | null = null;
  if (dbUrl.startsWith("file:")) {
    try {
      dbSize = statSync(dbUrl.slice("file:".length)).size;
    } catch {
      dbSize = null;
    }
  }

  const count = async (table: typeof likes | typeof hiddens) =>
    Number(
      (
        await db
          .select({ count: sql<number>`count(*)` })
          .from(table)
          .where(and(eq(table.externalUserId, ctx.token.userId), isNull(table.sessionCode)))
      )[0]?.count ?? 0
    );

  const [likedCount, hiddenCount, sessionCount, included] = await Promise.all([
    count(likes),
    count(hiddens),
    db.select({ count: sql<number>`count(*)` }).from(sessions).then((rows: Array<{ count: number }>) => Number(rows[0]?.count ?? 0)),
    ConfigService.getIncludedLibraries(),
  ]);

  return {
    version: config.app.version,
    apiVersion: API_VERSION,
    provider,
    capabilities,
    basePath: config.app.basePath,
    node: process.version,
    uptimeSeconds: Math.round(process.uptime()),
    database: { kind: dbUrl.startsWith("file:") ? "sqlite" : "remote", sizeBytes: dbSize },
    config: {
      providerLock: config.app.providerLock,
      secureCookies: config.auth.secureCookies,
      maxImageWidth: config.images.maxWidth,
      imageConcurrency: config.images.concurrency,
      hasTmdbToken: Boolean(config.TMDB_ACCESS_TOKEN),
    },
    state: {
      soloLikes: likedCount,
      soloHidden: hiddenCount,
      sessions: sessionCount,
      includedLibraries: included.length,
      includedIsEverything: included.length === 0,
    },
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
