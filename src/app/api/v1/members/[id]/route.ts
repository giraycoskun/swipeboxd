import { and, desc, eq, isNull, sql } from "drizzle-orm";

import { agentRoute } from "@/lib/agent/route";
import { apiError } from "@/lib/agent/envelope";
import { db } from "@/lib/db";
import { hiddens, likes, sessionMembers } from "@/db/schema";

export const GET = agentRoute("read", "member", async (_ctx, request) => {
  const userId = decodeURIComponent(new URL(request.url).pathname.split("/").pop() ?? "");
  if (!userId) return apiError("BAD_REQUEST", "Pass a member id.");

  const count = async (table: typeof likes | typeof hiddens) =>
    Number(
      (
        await db
          .select({ count: sql<number>`count(*)` })
          .from(table)
          .where(and(eq(table.externalUserId, userId), isNull(table.sessionCode)))
      )[0]?.count ?? 0
    );

  const memberships = await db
    .select({ code: sessionMembers.sessionCode, name: sessionMembers.externalUserName, joinedAt: sessionMembers.joinedAt })
    .from(sessionMembers)
    .where(eq(sessionMembers.externalUserId, userId));

  const [last] = await db
    .select({ createdAt: likes.createdAt })
    .from(likes)
    .where(eq(likes.externalUserId, userId))
    .orderBy(desc(likes.createdAt))
    .limit(1);

  const name = memberships[0]?.name ?? null;

  return {
    userId,
    name,
    solo: { liked: await count(likes), hidden: await count(hiddens) },
    lastSwipeAt: last?.createdAt ?? null,
    sessions: memberships.map((membership: { code: string; name: string; joinedAt: string }) => ({
      code: membership.code,
      joinedAt: membership.joinedAt,
      role: membership.name === name ? "member" : "member",
    })),
  };
});
