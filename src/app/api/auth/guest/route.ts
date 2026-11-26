import { NextRequest, NextResponse } from "next/server";
import { getIronSession } from "iron-session";
import { getSessionOptions } from "@/lib/session";
import { cookies } from "next/headers";
import { SessionData } from "@/types";
import { guestLoginSchema } from "@/lib/validations";
import { getRuntimeConfig } from "@/lib/runtime-config";
import { SessionService } from "@/lib/services/session-service";
import { logger } from "@/lib/logger";
import { handleApiError } from "@/lib/api-utils";
import { saveProfileAvatar } from "@/lib/server/profile-picture";

export async function POST(request: NextRequest) {
    const { capabilities } = getRuntimeConfig();
    try {
        const body = await request.json();
        const validated = guestLoginSchema.safeParse(body);

        if (!validated.success) {
            return NextResponse.json({ message: "Invalid input" }, { status: 400 });
        }

        const { username, sessionCode, avatarId } = validated.data;

        const { user, code } = await SessionService.loginGuest(username, sessionCode, capabilities);
        
        const cookieStore = await cookies();
        const session = await getIronSession<SessionData>(cookieStore, await getSessionOptions());

        session.user = user;
        session.isLoggedIn = true;
        session.sessionCode = code;

        if (avatarId) {
            try {
                await saveProfileAvatar(user.Id, avatarId);
            } catch (e) {
                logger.error("[Guest Auth] Failed to save avatar:", e);
            }
        }

        await session.save();

        return NextResponse.json({ success: true, user: session.user });

  } catch (error: any) {
    const status = error.message === "Session not found" ? 404 : 
                   error.message === "This session does not allow guest lending" ? 403 : 500;
    
    if (status === 500) {
        return handleApiError(error, "Failed to join as guest");
    }

    return NextResponse.json(
      { message: error.message || "Failed to join as guest" },
      { status }
    );
  }
}
