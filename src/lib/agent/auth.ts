import { NextRequest } from "next/server";

import { apiError } from "./envelope";
import { readAgentCredential, verifyAgentToken } from "./tokens";
import { scopeAllows, type AgentScope, type AgentTokenRow } from "@/types/agent";
import type { SessionData } from "@/types/auth";

/**
 * The context an authenticated agent request carries. `session` is null when the
 * token was minted without a provider credential — tools that need the media
 * server then answer `PROVIDER_AUTH_REQUIRED` instead of pretending.
 */
export interface AgentContext {
  token: AgentTokenRow;
  session: SessionData | null;
  scope: AgentScope;
}

export type AuthResult = { ok: true; ctx: AgentContext } | { ok: false; response: Response };

const HINT =
  "Create a token in Settings → Agents, or run `messer-swipe` inside the container — it uses the local token.";

export async function authenticate(request: NextRequest, required: AgentScope): Promise<AuthResult> {
  const header = (request.headers.get("authorization") ?? "").trim();
  const match = /^Bearer\s+(\S+)$/i.exec(header);

  if (!match) {
    return {
      ok: false,
      response: apiError("UNAUTHORIZED", "This endpoint needs an agent token.", { hint: HINT }),
    };
  }

  const row = await verifyAgentToken(match[1]);
  if (!row) {
    return {
      ok: false,
      response: apiError("UNAUTHORIZED", "That token is unknown, revoked, or not valid.", { hint: HINT }),
    };
  }

  const scope = row.scope as AgentScope;
  if (!scopeAllows(scope, required)) {
    return {
      ok: false,
      response: apiError(
        "FORBIDDEN",
        `This token is scoped "${scope}"; the request needs "${required}".`,
        { hint: "Create a token with the wider scope in Settings → Agents." }
      ),
    };
  }

  const credential = await readAgentCredential(row);
  const session: SessionData | null = credential
    ? {
        user: { ...credential, DeviceId: credential.DeviceId ?? "" },
        isLoggedIn: true,
      }
    : null;

  return { ok: true, ctx: { token: row, session, scope } };
}
