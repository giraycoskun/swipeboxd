import { and, eq, isNull } from "drizzle-orm";

import { agentRoute } from "@/lib/agent/route";
import { apiError } from "@/lib/agent/envelope";
import { db } from "@/lib/db";
import { hiddens, likes } from "@/db/schema";
import { config } from "@/lib/config";
import { AuthService } from "@/lib/services/auth-service";
import { getMediaProvider } from "@/lib/providers/factory";
import { detailsIdFor, isTmdbSourcedId, resolveItemSource } from "@/lib/providers/item-source";
import { getProviderDetailsUrl } from "@/lib/provider-links";
import { itemKind } from "@/lib/media-kind";
import { ProviderType } from "@/lib/providers/types";

export const GET = agentRoute("read", "media-item", async (ctx, request) => {
  if (!ctx.session) {
    return apiError("PROVIDER_AUTH_REQUIRED", "This token carries no provider credential.");
  }

  const id = decodeURIComponent(new URL(request.url).pathname.split("/").pop() ?? "");
  if (!id) return apiError("BAD_REQUEST", "Pass a media id.");

  try {
    const auth = await AuthService.getEffectiveCredentials(ctx.session);
    const { providerType: resolved } = resolveItemSource(id, (auth.provider as ProviderType) ?? ProviderType.JELLYFIN);
    const providerType = (resolved ?? ProviderType.JELLYFIN) as ProviderType;
    const provider = getMediaProvider(providerType);
    const item = await provider.getItemDetails(detailsIdFor(id, providerType), auth, { includeUserState: true });

    const userId = ctx.token.userId;
    const [likedRow] = await db
      .select({ id: likes.id })
      .from(likes)
      .where(and(eq(likes.externalId, id), eq(likes.externalUserId, userId), isNull(likes.sessionCode)))
      .limit(1);
    const [hiddenRow] = await db
      .select({ id: hiddens.id })
      .from(hiddens)
      .where(and(eq(hiddens.externalId, id), eq(hiddens.externalUserId, userId), isNull(hiddens.sessionCode)))
      .limit(1);

    // Prefer the member's own server over the instance-wide one. That is the bug in
    // #99, and this endpoint must not repeat it.
    const serverUrl = ctx.session.user.providerConfig?.serverUrl || config.server.publicUrl || "";

    return {
      id,
      name: item.Name,
      year: item.ProductionYear ?? null,
      kind: itemKind(item),
      overview: item.Overview ?? null,
      runtimeMinutes: item.RunTimeTicks ? Math.round(item.RunTimeTicks / 600_000_000) : null,
      genres: item.Genres ?? [],
      rating: item.CommunityRating ?? null,
      officialRating: item.OfficialRating ?? null,
      inLibrary: !isTmdbSourcedId(id) || item.InLibrary !== false,
      watchUrl: getProviderDetailsUrl({ provider: providerType, serverPublicUrl: serverUrl, itemId: id }),
      state: { liked: Boolean(likedRow), hidden: Boolean(hiddenRow) },
    };
  } catch (error) {
    return apiError("NOT_FOUND", `No item "${id}" on this provider.`, {
      hint: error instanceof Error ? error.message : undefined,
    });
  }
});
