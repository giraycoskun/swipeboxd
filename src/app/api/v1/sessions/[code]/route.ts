import { and, eq, sql } from "drizzle-orm";

import { agentRoute } from "@/lib/agent/route";
import { apiError } from "@/lib/agent/envelope";
import { db } from "@/lib/db";
import { likes, sessionMembers, sessions } from "@/db/schema";

export const GET = agentRoute("read", "session", async (_ctx, request) => {
  const code = decodeURIComponent(new URL(request.url).pathname.split("/").pop() ?? "").toUpperCase();
  if (!code) return apiError("BAD_REQUEST", "Pass a session code.");

  const [row] = await db.select().from(sessions).where(eq(sessions.code, code)).limit(1);
  if (!row) return apiError("NOT_FOUND", `No session "${code}".`);

  const members = await db
    .select({
      userId: sessionMembers.externalUserId,
      name: sessionMembers.externalUserName,
      joinedAt: sessionMembers.joinedAt,
    })
    .from(sessionMembers)
    .where(eq(sessionMembers.sessionCode, code));

  const swipes = await db
    .select({ userId: likes.externalUserId, count: sql<number>`count(*)` })
    .from(likes)
    .where(eq(likes.sessionCode, code))
    .groupBy(likes.externalUserId);

  const [matchRow] = await db
    .select({ count: sql<number>`count(*)` })
    .from(likes)
    .where(and(eq(likes.sessionCode, code), eq(likes.isMatch, true)));

  const swipeByUser = new Map(
    swipes.map((entry: { userId: string; count: number }) => [entry.userId, Number(entry.count)])
  );

  return {
    code: row.code,
    hostUserId: row.hostUserId,
    provider: row.provider ?? null,
    createdAt: row.createdAt,
    members: members.map((member: { userId: string; name: string; joinedAt: string }) => ({
      userId: member.userId,
      name: member.name,
      joinedAt: member.joinedAt,
      likes: swipeByUser.get(member.userId) ?? 0,
    })),
    matches: Number(matchRow?.count ?? 0),
  };
});
