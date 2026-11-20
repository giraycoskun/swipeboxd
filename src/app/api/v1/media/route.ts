import { agentRoute } from "@/lib/agent/route";
import { apiError } from "@/lib/agent/envelope";
import { config } from "@/lib/config";
import { getEffectiveCapabilities } from "@/lib/runtime-config";
import { MediaService } from "@/lib/services/media-service";
import { itemKind } from "@/lib/media-kind";
import { ProviderType } from "@/lib/providers/types";
import type { Filters } from "@/types/session";

export const GET = agentRoute("read", "media", async (ctx, request) => {
  if (!ctx.session) {
    return apiError("PROVIDER_AUTH_REQUIRED", "This token carries no provider credential.", {
      hint: "Log in through the browser once as an administrator; the local token then carries it.",
    });
  }

  const query = (new URL(request.url).searchParams.get("query") ?? "").trim();
  if (query.length < 2) {
    return apiError("BAD_REQUEST", "A search needs at least two characters.", { hint: "GET /api/v1/media?query=dune" });
  }

  const capabilities = getEffectiveCapabilities(config.app.provider as ProviderType);
  const filters: Filters = {
    genres: [],
    kinds: capabilities.hasSeries ? ["movie", "series"] : ["movie"],
    deckMode: capabilities.hasSeries ? "mixed" : "movies",
  };

  try {
    const page = await MediaService.getMediaItems(ctx.session, 0, 20, query, filters);
    return {
      query,
      items: (page.items ?? []).map((item) => ({
        id: item.Id,
        name: item.Name,
        year: item.ProductionYear ?? null,
        kind: itemKind(item),
        rating: item.CommunityRating ?? null,
      })),
    };
  } catch (error) {
    return apiError("PROVIDER_UNREACHABLE", `The media server did not answer: ${error instanceof Error ? error.message : String(error)}`);
  }
});
