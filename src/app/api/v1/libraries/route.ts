import { agentRoute } from "@/lib/agent/route";
import { apiError } from "@/lib/agent/envelope";
import { ConfigService } from "@/lib/services/config-service";
import { MediaService } from "@/lib/services/media-service";

function providerAuthRequired() {
  return apiError(
    "PROVIDER_AUTH_REQUIRED",
    "This token carries no provider credential, so it cannot read the media server.",
    {
      hint: "Log in through the browser once as an administrator; the container then mints a local token that carries the credential.",
    }
  );
}

export const GET = agentRoute("read", "libraries", async (ctx) => {
  if (!ctx.session) return providerAuthRequired();

  let libraries;
  try {
    libraries = await MediaService.getLibraries(ctx.session);
  } catch (error) {
    return apiError(
      "PROVIDER_UNREACHABLE",
      `The media server did not answer: ${error instanceof Error ? error.message : String(error)}`,
      { hint: "Check the provider URL and that it is reachable from the container." }
    );
  }

  const included = await ConfigService.getIncludedLibraries();
  const includedIsEverything = included.length === 0;

  return {
    includedIsEverything,
    libraries: libraries.map((library) => ({
      id: library.Id,
      name: library.Name,
      type: library.CollectionType ?? null,
      included: includedIsEverything || included.includes(library.Id),
    })),
  };
});
