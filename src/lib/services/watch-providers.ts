import "server-only";
import { ProviderType } from "@/lib/providers/types";
import { TMDB_TV_ID_PREFIX } from "@/lib/constants";
import { itemKind } from "@/lib/media-kind";
import { getMediaProvider } from "@/lib/providers/factory";
import { getTmdbProviderId, isTmdbSourcedId } from "@/lib/providers/item-source";
import { getEffectiveCapabilities } from "@/lib/runtime-config";
import { logger } from "@/lib/logger";
import type { AuthContext } from "@/lib/providers/types";
import type { MediaItem } from "@/types";

/**
 * A library item knows its own title but nothing about where that title streams. On a Jellyfin
 * server with TMDB configured, one TMDB lookup fills `WatchProviders` so a row can draw its
 * service strip.
 *
 * It lives here because *two* routes answer the same question: the item endpoint (the detail
 * sheet, and the sync that follows a favourite) and the likes list. Only the item endpoint used
 * to enrich, so a library row had no services at list render and gained them the moment it was
 * interacted with — a logo appearing under the user's finger, gone again on reload. Both call
 * this, so the list is complete from the first paint.
 *
 * Non-fatal by design: a TMDB failure leaves the row without a strip instead of failing the list.
 * TMDB-sourced rows already carry their services; nothing to do.
 */
/** `AuthService.getEffectiveCredentials` adds the session's provider to the adapter's context. */
type EffectiveAuth = AuthContext & { provider?: string };

export async function attachWatchProviders(item: MediaItem, auth: EffectiveAuth): Promise<MediaItem> {
  if (isTmdbSourcedId(item.Id)) return item;
  if (auth.provider !== ProviderType.JELLYFIN) return item;
  if (!getEffectiveCapabilities(auth.provider).hasStreamingSettings) return item;

  const tmdbId = getTmdbProviderId(item);
  if (!tmdbId) return item;

  // A series needs the typed id: TMDB keeps films and shows in separate id spaces, so a bare
  // number resolves to whatever film shares it (AGENTS.md invariant 5). The old inline copy of
  // this lookup passed the bare id, which is why a show in the list never showed its services.
  const detailsId = itemKind(item) === "series" ? `${TMDB_TV_ID_PREFIX}${tmdbId}` : tmdbId;

  try {
    const tmdbDetails = await getMediaProvider(ProviderType.TMDB).getItemDetails(detailsId, auth);
    item.WatchProviders = tmdbDetails.WatchProviders;
  } catch (error) {
    logger.debug("Failed to enrich item with TMDB watch providers:", error);
  }

  return item;
}
