import { chmodSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

import { eq } from "drizzle-orm";

import { db } from "@/lib/db";
import { agentTokens } from "@/db/schema";
import { config } from "@/lib/config";
import { logger } from "@/lib/logger";
import { createAgentToken } from "./tokens";
import type { SessionData } from "@/types/auth";

/**
 * The token `docker exec` uses.
 *
 * The container cannot log in through a browser, so the first time an *admin's*
 * session is established the app mints one local token bound to that admin, writes
 * it beside the database (`0600`) and stops. `docker exec <container> messer-swipe
 * status` then needs no flags at all.
 *
 * Rotating is revoking: the next admin login finds no live local token and mints a
 * new one, overwriting the file.
 */
export function localTokenPath(): string {
  const url = config.db.url ?? "";
  if (url.startsWith("file:")) {
    const file = url.slice("file:".length);
    return join(dirname(file || "."), ".agent-token");
  }
  return join(process.cwd(), ".agent-token");
}

export async function ensureLocalAgentToken(session: SessionData): Promise<void> {
  if (!session?.isLoggedIn || !session.user?.isAdmin) return;

  try {
    const existing = (await db
      .select()
      .from(agentTokens)
      .where(eq(agentTokens.isLocal, true))
      .limit(1)) as Array<{ revokedAt: string | null }>;

    if (existing.length > 0 && !existing[0].revokedAt) return;

    const { token } = await createAgentToken({
      name: "local",
      scope: "admin",
      user: session.user,
      isLocal: true,
    });

    const path = localTokenPath();
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, `${token}\n`, { mode: 0o600 });
    chmodSync(path, 0o600);

    logger.info(
      `[agent] local token ready for ${session.user.Name} — docker exec <container> messer-swipe status`
    );
  } catch (error) {
    // Never fail a login because the convenience token could not be written.
    logger.warn("[agent] could not mint the local token", error);
  }
}
