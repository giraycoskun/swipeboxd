import { NextRequest, NextResponse } from "next/server";
import { getIronSession } from "iron-session";
import { cookies } from "next/headers";

import { getSessionOptions } from "@/lib/session";
import { AuthService } from "@/lib/services/auth-service";
import { revokeAgentToken } from "@/lib/agent/tokens";
import { handleApiError } from "@/lib/api-utils";
import type { SessionData } from "@/types/auth";

export async function DELETE(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const cookieStore = await cookies();
    const session = await getIronSession<SessionData>(cookieStore, await getSessionOptions());

    if (!session.isLoggedIn) return new NextResponse("Unauthorized", { status: 401 });

    const isAdmin = await AuthService.isAdmin(
      session.user.Id,
      session.user.Name,
      session.user.provider,
      !!session.user.isGuest
    );
    if (!isAdmin) return new NextResponse("Forbidden", { status: 403 });

    const { id } = await context.params;
    const revoked = await revokeAgentToken(id);
    if (!revoked) return NextResponse.json({ message: "No such token." }, { status: 404 });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleApiError(error, "Could not revoke the token.");
  }
}
