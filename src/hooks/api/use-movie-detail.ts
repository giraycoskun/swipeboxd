"use client";

import { useQuery } from "@tanstack/react-query";

import { apiClient } from "@/lib/api-client";
import { QUERY_KEYS } from "@/hooks/api/query-keys";
import type { MediaItem } from "@/types";

/**
 * The one description of the movie/series detail request.
 *
 * Both the sheet and the prefetch that runs when a card is hovered or sits at the
 * top of the deck use it, so the cache key cannot drift between them — a prefetch
 * under a different key is a second network call, not a warm sheet.
 */
export function movieDetailQueryOptions(movieId: string, sessionCode?: string | null) {
  const codeParam = sessionCode === null ? "" : (sessionCode ?? "");

  return {
    queryKey: QUERY_KEYS.movie(movieId, sessionCode, true),
    queryFn: async (): Promise<MediaItem> => {
      const res = await apiClient.get<MediaItem>(
        `/api/media/item/${movieId}?sessionCode=${codeParam}&includeUserState=1`
      );
      return res.data;
    },
    staleTime: 1000 * 60 * 5,
  };
}

export function useMovieDetails(movieId: string | null, sessionCode?: string | null) {
  return useQuery({
    ...movieDetailQueryOptions(movieId ?? "", sessionCode),
    enabled: !!movieId,
  });
}
