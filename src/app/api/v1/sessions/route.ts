import { desc, eq, sql } from "drizzle-orm";

import { agentRoute } from "@/lib/agent/route";
import { db } from "@/lib/db";
import { likes, sessionMembers, sessions } from "@/db/schema";

/** Group sessions, newest first. A solo deck is not a session and never appears here. */
export const GET = agentRoute("read", "sessions", async () => {
  const rows = await db
    .select({
      code: sessions.code,
      hostUserId: sessions.hostUserId,
      provider: sessions.provider,
      createdAt: sessions.createdAt,
    })
    .from(sessions)
    .orderBy(desc(sessions.createdAt))
    .limit(50);

  const members = await db
    .select({ sessionCode: sessionMembers.sessionCode, name: sessionMembers.externalUserName })
    .from(sessionMembers);

  const matches = await db
    .select({ sessionCode: likes.sessionCode, count: sql<number>`count(*)` })
    .from(likes)
    .where(eq(likes.isMatch, true))
    .groupBy(likes.sessionCode);

  const matchByCode = new Map(
    matches.map((row: { sessionCode: string | null; count: number }) => [row.sessionCode, Number(row.count)])
  );

  return {
    sessions: rows.map((row: { code: string; hostUserId: string; provider: string | null; createdAt: string }) => ({
      code: row.code,
      hostUserId: row.hostUserId,
      provider: row.provider ?? null,
      createdAt: row.createdAt,
      members: members
          .filter((member: { sessionCode: string; name: string }) => member.sessionCode === row.code)
          .map((member: { name: string }) => member.name),
      matches: matchByCode.get(row.code) ?? 0,
    })),
  };
});
