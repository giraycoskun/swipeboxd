import { agentRoute } from "@/lib/agent/route";
import type { AgentContext } from "@/lib/agent/auth";
import { apiError } from "@/lib/agent/envelope";
import { createAgentToken, listAgentTokens } from "@/lib/agent/tokens";
import { isAgentScope } from "@/types/agent";
import type { UserSession } from "@/types/auth";

/**
 * The identity a new token acts as: the caller's own session when the calling token
 * carries a provider credential, otherwise the identity recorded on that token. A
 * token minted without a credential still works — it answers PROVIDER_AUTH_REQUIRED
 * on provider-backed routes, exactly like a local token whose admin never logged in.
 */
function actor(ctx: AgentContext): UserSession {
  if (ctx.session) return ctx.session.user;
  return {
    Id: ctx.token.userId,
    Name: ctx.token.userName,
    DeviceId: "",
    provider: ctx.token.provider || undefined,
    isAdmin: true,
  };
}

/** Token management is the CLI's job (`messer-swipe token …`); there is no UI for it. */
export const GET = agentRoute("admin", "tokens", async () => ({ tokens: await listAgentTokens() }));

export const POST = agentRoute("admin", "tokens.create", async (ctx, request) => {
  let body: unknown = null;
  try {
    body = await request.json();
  } catch {
    return apiError("BAD_REQUEST", "The body is not JSON.", {
      hint: '{"name":"laptop","scope":"read"}',
    });
  }

  const input = body as { name?: unknown; scope?: unknown };
  const name = typeof input?.name === "string" ? input.name.trim() : "";
  if (!name) {
    return apiError("BAD_REQUEST", "Give the token a name.", {
      hint: "messer-swipe token create laptop --scope read",
    });
  }
  if (input.scope !== undefined && !isAgentScope(input.scope)) {
    return apiError("BAD_REQUEST", 'scope is "read", "write" or "admin".');
  }

  const { token, record } = await createAgentToken({
    name,
    scope: isAgentScope(input.scope) ? input.scope : "read",
    user: actor(ctx),
  });

  // The plaintext leaves the server exactly once, in this response.
  return { token, record };
});
