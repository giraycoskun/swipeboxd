import { and, eq, isNull, sql } from "drizzle-orm";

import { agentRoute } from "@/lib/agent/route";
import { apiError } from "@/lib/agent/envelope";
import { diagnoseDeck } from "@/lib/agent/deck";
import { db } from "@/lib/db";
import { hiddens, likes } from "@/db/schema";
import { config } from "@/lib/config";
import { getEffectiveCapabilities } from "@/lib/runtime-config";
import { ConfigService } from "@/lib/services/config-service";
import { MediaService } from "@/lib/services/media-service";
import { itemKind } from "@/lib/media-kind";
import type { ProviderType } from "@/lib/providers/types";
import type { Filters } from "@/types/session";
import type { MediaItem } from "@/types/media";

function providerAuthRequired() {
  return apiError(
    "PROVIDER_AUTH_REQUIRED",
    "This token carries no provider credential, so it cannot build a deck.",
    {
      hint: "Log in through the browser once as an administrator; the container then mints a local token that carries the credential.",
    }
  );
}

async function countSwipes(userId: string): Promise<number> {
  const [liked] = await db
    .select({ count: sql<number>`count(*)` })
    .from(likes)
    .where(and(eq(likes.externalUserId, userId), isNull(likes.sessionCode)));
  const [hidden] = await db
    .select({ count: sql<number>`count(*)` })
    .from(hiddens)
    .where(and(eq(hiddens.externalUserId, userId), isNull(hiddens.sessionCode)));
  return Number(liked?.count ?? 0) + Number(hidden?.count ?? 0);
}

/**
 * The deck an operator sees: no filters, every kind the provider supports.
 * `why=1` adds the diagnosis — the reason an empty deck is empty, which the UI
 * never has to explain because it can see the filters it wrote itself.
 */
export const GET = agentRoute("read", "deck", async (ctx, request) => {
  if (!ctx.session) return providerAuthRequired();

  const searchParams = new URL(request.url).searchParams;
  const requested = Number(searchParams.get("limit") ?? "10");
  const limit = Number.isFinite(requested) ? Math.min(50, Math.max(1, Math.trunc(requested))) : 10;

  const provider = config.app.provider as ProviderType;
  const capabilities = getEffectiveCapabilities(provider);
  const filters: Filters = {
    genres: [],
    kinds: capabilities.hasSeries ? ["movie", "series"] : ["movie"],
    deckMode: capabilities.hasSeries ? "mixed" : "movies",
  };

  const startedAt = Date.now();
  let libraryIds: string[] = [];
  let items: MediaItem[] = [];
  let providerError: string | null = null;

  try {
    const libraries = await MediaService.getLibraries(ctx.session);
    libraryIds = libraries.map((library) => library.Id);
    const page = await MediaService.getMediaItems(ctx.session, 0, limit, undefined, filters);
    items = page.items ?? [];
  } catch (error) {
    providerError = error instanceof Error ? error.message : String(error);
  }

  const included = await ConfigService.getIncludedLibraries();
  const swiped = await countSwipes(ctx.token.userId);

  const diagnosis = diagnoseDeck({
    libraryIds,
    includedLibraries: included,
    returned: items.length,
    swiped,
    providerError,
  });

  return {
    deckMode: filters.deckMode,
    kinds: filters.kinds,
    libraries: {
      total: libraryIds.length,
      included: included.length,
      includedIsEverything: included.length === 0,
    },
    counts: { returned: items.length, swiped, limit },
    provider: { reachable: providerError === null, durationMs: Date.now() - startedAt },
    items: items.map((item) => ({
      id: String(item.Id ?? ""),
      name: String(item.Name ?? ""),
      year: typeof item.ProductionYear === "number" ? item.ProductionYear : null,
      kind: itemKind(item),
      rating: typeof item.CommunityRating === "number" ? item.CommunityRating : null,
      officialRating: typeof item.OfficialRating === "string" ? item.OfficialRating : null,
    })),
    diagnosis,
  };
});
