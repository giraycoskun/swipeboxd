import { NextRequest, NextResponse } from "next/server";
import { getIronSession } from "iron-session";
import { cookies } from "next/headers";

import { getSessionOptions } from "@/lib/session";
import { AuthService } from "@/lib/services/auth-service";
import { createAgentToken, listAgentTokens } from "@/lib/agent/tokens";
import { handleApiError } from "@/lib/api-utils";
import { isAgentScope, type AgentScope } from "@/types/agent";
import type { SessionData } from "@/types/auth";

async function requireAdmin() {
  const cookieStore = await cookies();
  const session = await getIronSession<SessionData>(cookieStore, await getSessionOptions());
  if (!session.isLoggedIn) {
    return { error: new NextResponse("Unauthorized", { status: 401 }) } as const;
  }
  const isAdmin = await AuthService.isAdmin(
    session.user.Id,
    session.user.Name,
    session.user.provider,
    !!session.user.isGuest
  );
  if (!isAdmin) {
    return { error: new NextResponse("Forbidden", { status: 403 }) } as const;
  }
  return { session } as const;
}

export async function GET() {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;
  return NextResponse.json({ tokens: await listAgentTokens() });
}

export async function POST(request: NextRequest) {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;

  try {
    const body = await request.json();
    const name = typeof body?.name === "string" ? body.name.trim() : "";
    const scope: AgentScope = isAgentScope(body?.scope) ? body.scope : "read";

    if (name.length < 1) {
      return NextResponse.json({ message: "Give the token a name." }, { status: 400 });
    }

    // The token acts as the admin who created it, and is shown exactly once.
    const { token, record } = await createAgentToken({ name, scope, user: auth.session.user });

    return NextResponse.json({ token, record }, { status: 201 });
  } catch (error) {
    return handleApiError(error, "Could not create the token.");
  }
}
