import { agentRoute } from "@/lib/agent/route";
import { apiError } from "@/lib/agent/envelope";
import { listAgentTokens, revokeAgentToken } from "@/lib/agent/tokens";

/** Revoke by id or by prefix — `token list` prints the prefix, the JSON carries the id. */
export const DELETE = agentRoute("admin", "tokens.revoke", async (ctx, request) => {
  const target = decodeURIComponent(new URL(request.url).pathname.split("/").pop() ?? "");
  if (!target) {
    return apiError("BAD_REQUEST", "Pass a token id or prefix.", { hint: "messer-swipe token list" });
  }

  const tokens = await listAgentTokens();
  const row = tokens.find((t) => t.id === target || t.prefix === target);
  if (!row) {
    return apiError("NOT_FOUND", `No token "${target}".`, { hint: "messer-swipe token list" });
  }

  // Revoking the token in your own hand would remove the only key you have.
  if (row.id === ctx.token.id) {
    return apiError("BAD_REQUEST", "That is the token this request used.", {
      hint: "Revoke it with another admin token, or delete /app/data/.agent-token inside the container and log in again.",
    });
  }
  if (row.revokedAt) return { revoked: row.id, prefix: row.prefix, alreadyRevoked: true };

  const ok = await revokeAgentToken(row.id);
  if (!ok) return apiError("INTERNAL", "The token row did not change.");
  return { revoked: row.id, prefix: row.prefix, name: row.name, scope: row.scope };
});
