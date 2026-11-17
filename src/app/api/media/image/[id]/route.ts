import { NextRequest, NextResponse } from "next/server";
import { getIronSession } from "iron-session";
import { cookies } from "next/headers";
import { getSessionOptions } from "@/lib/session";
import { SessionData } from "@/types";
import { getMediaProvider } from "@/lib/providers/factory";
import { AuthService } from "@/lib/services/auth-service";
import { db, userProfiles } from "@/lib/db";
import { eq } from "drizzle-orm";
import { logger } from "@/lib/logger";
import { ProviderType } from "@/lib/providers/types";
import { resolveItemSource } from "@/lib/providers/item-source";
import { config } from "@/lib/config";
import { imageQueryFor, parseImageRequest } from "@/lib/image-request";
import { createSemaphore } from "@/lib/semaphore";

/**
 * One resize at a time is what the media server can actually do: a deck asks for
 * five posters at once and Jellyfin re-encodes each on the CPU, so the fifth
 * answer arrives after the client has given up (issue #94). Queueing the fetches
 * keeps every single request inside its own timeout instead.
 */
const imageQueue = createSemaphore(config.images.concurrency);

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!id || id === "undefined") {
    return new NextResponse("Invalid ID", { status: 400 });
  }

  const searchParams = request.nextUrl.searchParams;
  const isUserType = searchParams.get("type") === "user";
  const imageType = searchParams.get("imageType") || "Primary";
  const tag = searchParams.get("tag") === "undefined" ? null : searchParams.get("tag");

  const cookieStore = await cookies();
  const session = await getIronSession<SessionData>(cookieStore, await getSessionOptions());
  
  let auth: Awaited<ReturnType<typeof AuthService.getEffectiveCredentials>> | undefined;
  try {
      auth = await AuthService.getEffectiveCredentials(session);
  } catch (e) {
      // Guest or no-auth might fail, that's okay for some providers like TMDB
  }

  if (isUserType) {
    const customProfile = await db.select().from(userProfiles).where(eq(userProfiles.userId, id)).then((rows: any[]) => rows[0]);
    if (customProfile?.image) {
      return new NextResponse(customProfile.image as any, {
        status: 200,
        headers: {
          "Content-Type": customProfile.contentType || "image/webp",
          "Cache-Control": "no-cache, no-store, must-revalidate",
        },
      });
    }
  }

  // Always derive the provider from the authenticated session — never from a
  // client-supplied query parameter — to prevent provider-confusion attacks (M4).
  // The tmdb: prefix (hybrid streaming-only items) is safe: it can only ever
  // select TMDB, which uses the server's env token, never user credentials.
  const { providerType, externalId } = isUserType
    ? { providerType: auth?.provider, externalId: id }
    : resolveItemSource(id, auth?.provider);
  const provider = getMediaProvider(providerType);

  // If no tag is provided, some providers (like TMDB) might use the ID if it looks like a path
  const effectiveTag = tag || (providerType === ProviderType.TMDB ? externalId : undefined);

  if (!effectiveTag && !isUserType && providerType === ProviderType.TMDB) {
    return new NextResponse("Missing image tag", { status: 400 });
  }

  if ((providerType === ProviderType.PLEX || provider?.name === ProviderType.PLEX) && effectiveTag && effectiveTag.startsWith("http")) {
    try {
      provider.getImageUrl(externalId, isUserType ? "user" : (imageType as any), effectiveTag, auth);
    } catch (e: any) {
      return new NextResponse("External image host not allowed", { status: 400 });
    }
  }

  // Only the two params that mean something to a provider are forwarded, mapped
  // to that provider's own dialect. Everything else a client sends is dropped:
  // forwarding arbitrary params is how `width=1600` reached a phone's decode
  // budget in the first place.
  const requested = parseImageRequest(searchParams, config.images.maxWidth);
  const options = imageQueryFor(providerType, requested);

  try {
    const response = await imageQueue.run(async () => {
      let timer: ReturnType<typeof setTimeout> | undefined;
      const timeout = new Promise<never>((_, reject) => {
        timer = setTimeout(
          () => reject(Object.assign(new Error("Image request timed out"), { code: "IMAGE_TIMEOUT" })),
          config.images.timeoutMs
        );
      });
      try {
        return await Promise.race([
          provider.fetchImage(externalId, isUserType ? "user" : imageType, effectiveTag || undefined, auth, options),
          timeout,
        ]);
      } finally {
        if (timer) clearTimeout(timer);
      }
    });

    return new NextResponse(response.data as any, {
      status: 200,
      headers: {
        "Content-Type": response.contentType,
        "Cache-Control": isUserType ? "no-cache, no-store, must-revalidate" : "public, max-age=31536000, immutable",
        "X-Image-Width": String(requested.width),
      },
    });

  } catch (error: any) {
    if (error?.code === "IMAGE_TIMEOUT") {
      // A gateway timeout, not a broken image: the client keeps its placeholder
      // and retries on the next request instead of caching a failure forever.
      logger.warn(`Image ${externalId} timed out after ${config.images.timeoutMs} ms at ${requested.width}px`);
      return new NextResponse("Image request timed out", {
        status: 504,
        headers: { "Cache-Control": "no-store" },
      });
    }
    if (error.response?.status === 404) {
      return new NextResponse("Image not found", { status: 404 });
    }
    logger.error("Error proxying image:", error.message);
    if (isUserType) return new NextResponse("User image not found", { status: 404 });
    return new NextResponse("Error fetching image", { status: 500 });
  }
}
