import { randomUUID, timingSafeEqual } from "node:crypto";

import { NextRequest, NextResponse } from "next/server";
import { getIronSession } from "iron-session";
import { cookies } from "next/headers";

import { getSessionOptions } from "@/lib/session";
import type { SessionData } from "@/types";
import { getMediaProvider } from "@/lib/providers/factory";
import { AuthService } from "@/lib/services/auth-service";
import { logger } from "@/lib/logger";
import {
  impersonationEnabled,
  loadIdentities,
  pickIdentity,
  resolveCredentials,
} from "@/lib/dev/identities";

const NOT_FOUND = () => new NextResponse(null, { status: 404 });

function safeEqual(left: string, right: string): boolean {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  if (a.length === 0 || a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

/**
 * Dev-only one-tap sign-in: `GET /api/dev/impersonate?as=<identity>&k=<key>`.
 *
 * Only reachable on a dev server the launcher started (DEV_IMPERSONATE=1 and a
 * per-boot key); production has neither, so this route answers 404 there. It
 * mints a session through the app's own provider adapter, which means Plex's
 * per-server token exchange is exactly the one the login route uses.
 *
 * Credentials are read at request time from the 600 files named by the identity
 * registry. They are never logged, never stored, and never put in the process
 * environment.
 */
export async function GET(request: NextRequest) {
  if (!impersonationEnabled(process.env)) return NOT_FOUND();

  const key = process.env.DEV_IMPERSONATE_KEY ?? "";
  const provided = request.nextUrl.searchParams.get("k") ?? "";
  if (!safeEqual(provided, key)) return NOT_FOUND();

  const wanted = request.nextUrl.searchParams.get("as") ?? "";
  const registryFile = process.env.SWIPE_IDENTITIES_FILE ?? "";

  try {
    const identity = pickIdentity(loadIdentities(registryFile), wanted);
    if (!identity) return NOT_FOUND();

    const provider = getMediaProvider(identity.provider);
    if (!provider.authenticate) {
      return new NextResponse("This provider cannot be impersonated", { status: 400 });
    }

    const deviceId = `portal-impersonate-${wanted}-${randomUUID()}`;
    const { username, password } = resolveCredentials(identity);
    logger.info(`[DevImpersonate] signing in as ${identity.value} (${identity.provider})`);

    const authResult = await provider.authenticate(
      username,
      password,
      deviceId,
      identity.providerUrl
    );
    const userId = authResult.User?.Id || authResult.id;
    const userName = authResult.User?.Name || authResult.name;
    const accessToken = authResult.AccessToken || authResult.accessToken;

    if (!userId) {
      return new NextResponse("The provider did not return a user", { status: 400 });
    }

    const cookieStore = await cookies();
    const session = await getIronSession<SessionData>(cookieStore, await getSessionOptions());
    session.user = {
      Id: String(userId),
      Name: userName || username,
      AccessToken: accessToken,
      DeviceId: deviceId,
      isAdmin: await AuthService.isAdmin(userId, userName || username, identity.provider),
      provider: identity.provider,
      providerConfig: { serverUrl: identity.providerUrl },
    };
    session.isLoggedIn = true;
    await session.save();

    logger.info(`[DevImpersonate] session saved for ${session.user.Name}`);
    return NextResponse.redirect(new URL("/", request.url));
  } catch (error) {
    logger.warn(
      "[DevImpersonate] failed:",
      error instanceof Error ? error.message : String(error)
    );
    const message = error instanceof Error ? error.message : "impersonation failed";
    return new NextResponse(`Impersonation failed — ${message}`, { status: 400 });
  }
}
