import { NextRequest } from "next/server";

import { authenticate, type AgentContext } from "./auth";
import { apiError, apiOk } from "./envelope";
import { recordAgentAudit } from "./tokens";
import { logger } from "@/lib/logger";
import type { AgentScope } from "@/types/agent";

export type AgentHandler = (ctx: AgentContext, request: NextRequest) => Promise<unknown | Response>;

/**
 * One wrapper for every `/api/v1` handler: the kill switch, the bearer check, the
 * scope check, the envelope, the audit row, and a 500 that never leaks a stack.
 *
 * A handler returns data (wrapped in the envelope) or a whole `Response` when it
 * needs its own status — a 404 for an unknown id, say.
 */
export function agentRoute(scope: AgentScope, action: string, handler: AgentHandler) {
  return async (request: NextRequest): Promise<Response> => {
    const startedAt = Date.now();

    if (process.env.AGENT_API === "off") {
      return apiError("AGENT_API_DISABLED", "The agent API is disabled on this instance.", {
        hint: "Unset AGENT_API (or set it to anything but \"off\") and restart the container.",
      });
    }

    const auth = await authenticate(request, scope);
    if (!auth.ok) return auth.response;

    try {
      const result = await handler(auth.ctx, request);
      const response = result instanceof Response ? result : apiOk(result, startedAt);

      if (request.method !== "GET") {
        await recordAgentAudit({
          tokenId: auth.ctx.token.id,
          action,
          ok: response.ok,
          errorCode: response.ok ? null : `HTTP_${response.status}`,
          durationMs: Date.now() - startedAt,
        });
      }

      return response;
    } catch (error) {
      logger.error(`[agent:${action}]`, error);
      await recordAgentAudit({
        tokenId: auth.ctx.token.id,
        action,
        ok: false,
        errorCode: "INTERNAL",
        durationMs: Date.now() - startedAt,
      });
      return apiError("INTERNAL", "The instance failed to answer.", {
        hint: "Run `messer-swipe diag` inside the container for the detail.",
      });
    }
  };
}
