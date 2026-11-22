import { ProviderType } from "@/lib/providers/types";

interface ProviderDetailsUrlParams {
  provider: ProviderType | string;
  serverPublicUrl: string;
  machineId?: string | null;
  itemId: string;
}

export function getProviderDetailsUrl({ provider, serverPublicUrl, machineId, itemId }: ProviderDetailsUrlParams): string {
  const base = (serverPublicUrl || "").replace(/\/+$/, "");

  if (provider === ProviderType.PLEX) {
    const context = 'source:content.library~0~2'
    const key = encodeURIComponent(`/library/metadata/${itemId}`);
    const plexContext = encodeURIComponent(context || "source:content.library~0~2");
    const machineSegment = machineId ? `/server/${machineId}` : "";
    return `${base}/web/index.html#!${machineSegment}/details?key=${key}&context=${plexContext}`;
  }

  return `${base}/web/index.html#/details?id=${itemId}&context=home`;
}

/**
 * Which server a member's link should point at.
 *
 * The instance URL from the environment is only a fallback: it names the server in
 * compose, which is not necessarily the one the member logged into. Someone with two
 * Jellyfin servers opened the second one here, and every Watch button sent them to the
 * first (#99). `/api/session` answers with the member's own `serverUrl`, so wherever a
 * link leaves this app it is built from that first — the same order `/api/v1/media/:id`
 * already uses on the server side.
 */
export function detailsServerUrl(
  sessionServerUrl: string | null | undefined,
  runtimeServerUrl: string | null | undefined,
): string {
  return sessionServerUrl?.trim() || runtimeServerUrl?.trim() || "";
}
