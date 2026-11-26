import { NextRequest, NextResponse } from "next/server";
import { getIronSession } from "iron-session";
import { getSessionOptions } from "@/lib/session";
import { cookies } from "next/headers";
import { SessionData } from "@/types";
import axios from "axios";
import { loginSchema } from "@/lib/validations";
import { getMediaProvider } from "@/lib/providers/factory";
import { ConfigService } from "@/lib/services/config-service";
import { AuthService } from "@/lib/services/auth-service";
import { ensureLocalAgentToken } from "@/lib/agent/local";
import { logger } from "@/lib/logger";
import { handleApiError } from "@/lib/api-utils";
import { config } from "@/lib/config";
import { ProviderType } from "@/lib/providers/types";
import { watchlistUrl, watchlistUrlFromUsername } from "@/lib/providers/letterboxd/map";
import { saveProfileAvatar } from "@/lib/server/profile-picture";

export async function POST(request: NextRequest) {
    let usernameForLog = "unknown";
    try {
        const body = await request.json();
        const validated = loginSchema.safeParse(body);
        
        if (!validated.success) {
            return NextResponse.json({ message: "Invalid input" }, { status: 400 });
        }

        const { username, password, provider: bodyProvider, config: providerConfig, avatarId } = validated.data;
        usernameForLog = username;

        const baseDeviceId = crypto.randomUUID();
        const deviceId = `${baseDeviceId}-${username}`;

        logger.info(`[Auth] Attempting login for user: ${username} with deviceId: ${deviceId}`);

        if (bodyProvider && config.app.providerLock && bodyProvider !== config.app.provider) {
            return NextResponse.json({ message: "This instance uses a fixed data source." }, { status: 403 });
        }
        const provider = getMediaProvider(bodyProvider);
        const activeProviderName = provider.name;
        const { watchlistUsername, ...connectionConfig } = providerConfig ?? {};
        let activeProviderConfig: SessionData["user"]["providerConfig"] = providerConfig ? connectionConfig : undefined;
        if (activeProviderName === ProviderType.LETTERBOXD) {
            try {
                const url = config.app.providerLock
                    ? watchlistUrl(config.LETTERBOXD_WATCHLIST_URL)
                    : watchlistUrlFromUsername(watchlistUsername);
                activeProviderConfig = { watchlistUrl: url };
            } catch {
                const message = config.app.providerLock
                    ? "The instance's Letterboxd watchlist URL is not configured correctly."
                    : "Enter a Letterboxd username using only letters, numbers, or underscores.";
                return NextResponse.json({ message }, { status: 400 });
            }
        }
        
        if (!provider.authenticate) {
            return NextResponse.json({ message: "Authentication not supported by this provider" }, { status: 400 });
        }

        const authResult = await provider.authenticate(username, password, deviceId, providerConfig?.serverUrl || providerConfig?.tmdbToken);
        
        const userId = authResult.User?.Id || authResult.id;
        const userName = authResult.User?.Name || authResult.name;
        const accessToken = authResult.AccessToken || authResult.accessToken;

        logger.info("[Auth] Provider accepted credentials. User ID:", userId);

        // Set as admin if no admin exists for this provider and provider supports auth
        const existingAdmin = await ConfigService.getAdminUserId(activeProviderName);
        let wasMadeAdmin = false;
        if (!existingAdmin && provider.capabilities.hasAuth) {
            await ConfigService.setAdminUserId(userId, activeProviderName as any);
            wasMadeAdmin = true;
            logger.info(`[Auth] User ${userName} (${userId}) set as initial admin for ${activeProviderName}.`);
        }

        const cookieStore = await cookies();
        const session = await getIronSession<SessionData>(cookieStore, await getSessionOptions());

        session.user = {
            Id: userId,
            Name: userName,
            AccessToken: accessToken,
            DeviceId: deviceId,
            isAdmin: await AuthService.isAdmin(userId, userName, activeProviderName),
            wasMadeAdmin: wasMadeAdmin,
            provider: activeProviderName,
            providerConfig: activeProviderConfig,
        };
        session.sessionCode = undefined;
        session.isLoggedIn = true;

        if (avatarId) {
            try {
                await saveProfileAvatar(userId, avatarId);
            } catch (e) {
                logger.error("[Auth] Failed to save avatar:", e);
            }
        }
    
    await session.save();
    await ensureLocalAgentToken(session);

    logger.info("[Auth] Session cookie saved.");

    return NextResponse.json({ success: true, user: session.user, wasMadeAdmin });

    } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    logger.warn(`[Auth] Login Failed for user ${usernameForLog}:`, errorMessage);

    if (axios.isAxiosError(error)) {
       if (error.response) {
         if (error.response.status === 401) {
             return NextResponse.json({ message: "Invalid username or password" }, { status: 401 });
         }
       }
    }

    return handleApiError(error, "Server connection failed or invalid credentials. Check Messer Swipe logs for details.");
  }
}
