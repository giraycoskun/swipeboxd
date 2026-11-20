"use client";
import React, { useRef, useState, useMemo, useCallback, useEffect } from "react";
import { MediaItem, Filters } from "@/types";
import { SwipeCard, TinderCardHandle } from "./SwipeCard";
import { useMovieDetail } from "../movie/MovieDetailProvider";
import { UserAvatarList } from "../session/UserAvatarList";
import { FilterDrawer } from "./FilterDrawer";
import { MatchOverlay } from "./MatchOverlay";
import { useHotkeys } from "react-hotkeys-hook";
import { DeckControls } from "./DeckControls";
import { DeckHints } from "./DeckHints";
import { DeckEmpty } from "./DeckEmpty";
import { DeckError } from "./DeckError";
import { DeckLoading } from "./DeckLoading";
import { toast } from "sonner";
import { getErrorMessage } from "@/lib/utils";
import {
  useSession, 
  useDeck, 
  useStats, 
  useMembers, 
  useSwipe, 
  useUndoSwipe, 
  useUpdateSession,
  useUserSettings
} from "@/hooks/api";
import { useRuntimeConfig } from "@/lib/runtime-config";
import { hasAppliedFilters as deckHasAppliedFilters } from "@/lib/filters";
import { useBackgroundStore } from "@/lib/background-store";
import { ProviderType } from "@/lib/providers/types";
import { useQueryClient } from "@tanstack/react-query";
import { movieDetailQueryOptions } from "@/hooks/api/use-movie-detail";

export function CardDeck() {

  const { openMovie } = useMovieDetail();

  const { data: sessionStatus, isLoading: isLoadingSession, isError: isErrorSession } = useSession();
  const sessionCode = sessionStatus?.code || null;
  const sessionFilters = sessionStatus?.filters || { genres: [] };
  const sessionSettings = sessionStatus?.settings;

  const { data: stats } = useStats();
  const { 
    data: deckData, 
    isLoading, 
    isError, 
    refetch, 
    isFetching,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage
  } = useDeck();

  // Flatten the pages from useInfiniteQuery
  const deck = useMemo(() => {
    return deckData?.pages.flatMap(page => page.items) || [];
  }, [deckData]);
  const { data: members } = useMembers();
  const { capabilities } = useRuntimeConfig();
  const { data: userSettings } = useUserSettings();
  
  const swipeMutation = useSwipe();
  const undoSwipeMutation = useUndoSwipe();
  const updateSessionMutation = useUpdateSession();

  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [removedIds, setRemovedIds] = useState<string[]>([]);
  const swipedIdsRef = useRef<Set<string>>(new Set());
  const [lastSwipe, setLastSwipe] = useState<{ id: string; direction: "left" | "right" } | null>(null);
  const [rewindingId, setRewindingId] = useState<{ id: string; direction: "left" | "right" } | null>(null);
  const [displayDeck, setDisplayDeck] = useState<MediaItem[]>([]);
  const [matchedItem, setMatchedItem] = useState<MediaItem | null>(null);

  const { setBackgroundItem } = useBackgroundStore();

  const [isTransitioning, setIsTransitioning] = useState(false);

  // Track session/filters to detect mode changes
  const filtersJson = JSON.stringify(sessionStatus?.filters);
  const settingsHash = sessionStatus?.settingsHash;
  const currentModeRef = useRef<{ sessionCode: string | null; filtersJson: string }>({ 
    sessionCode, 
    filtersJson 
  });

  useEffect(() => {
    // If the session code or filters changed, we are transitioning to a new "mode"
    if (currentModeRef.current.sessionCode !== sessionCode || currentModeRef.current.filtersJson !== filtersJson) {
      setIsTransitioning(true);
      currentModeRef.current = { sessionCode, filtersJson };
      
      // If we already have the deck data (it's cached in React Query),
      // we can apply it immediately instead of waiting for the next effect run
      if (deck && Array.isArray(deck) && !isLoading) {
        setDisplayDeck(deck);
        setRemovedIds([]);
        swipedIdsRef.current.clear();
        setLastSwipe(null);
        setIsTransitioning(false);
      }
    }
  }, [sessionCode, filtersJson, settingsHash, deck, isLoading]);

   // Update displayDeck when new items are fetched or filters change
  useEffect(() => {
    if (deck && Array.isArray(deck) && !isLoading) {
      if (isTransitioning) {
        // First batch of data for new filters/mode has arrived
        setDisplayDeck(deck);
        setRemovedIds([]);
        swipedIdsRef.current.clear();
        setLastSwipe(null);
        setIsTransitioning(false);
      } else {
        // Normal pagination or data update within the same mode
        // If we are in the middle of a transition but deck changed, it's likely the new data
        setDisplayDeck((prev) => {
          // If the deck is completely different (e.g. session change), reset instead of append
          // We detect this by checking if there's any overlap in the first few items
          const currentFirstId = prev[0]?.Id;
          const newFirstId = deck[0]?.Id;
          
          if (prev.length > 0 && newFirstId && !deck.some(item => item.Id === currentFirstId) && !prev.some(item => item.Id === newFirstId)) {
            // Deck seems entirely new, reset state
            // Use setTimeout to avoid state updates during render if needed, but here it's inside an effect
            setRemovedIds([]);
            swipedIdsRef.current.clear();
            setLastSwipe(null);
            return deck;
          }

          const existingIds = new Set(prev.map((i) => i.Id));
          const newItems = deck.filter((item) => !existingIds.has(item.Id));
          if (newItems.length === 0) return prev;
          return [...prev, ...newItems];
        });
      }
    }
  }, [deck, deckData, isLoading, isTransitioning]);

  // Fallback to clear transition state if data is already there but effect didn't catch it
  useEffect(() => {
    if (isTransitioning && deckData && !isLoading) {
      setIsTransitioning(false);
    }
  }, [isTransitioning, deckData, isLoading]);

  const cardRefs = useRef<Record<string, React.RefObject<TinderCardHandle | null>>>({});

  // Pre-generate refs for the deck to avoid modifying refs during render
  useMemo(() => {
    displayDeck.forEach(item => {
      if (!cardRefs.current[item.Id]) {
        cardRefs.current[item.Id] = React.createRef<TinderCardHandle>();
      }
    });
  }, [displayDeck]);

  const getCardRef = (id: string) => {
    return cardRefs.current[id];
  };

  const hasAppliedFilters = useMemo(() => {
    // One definition, shared with the drawer (`src/lib/filters.ts`): the dot shows
    // when the stored filters narrow the deck. It used to light up for a sort the
    // hybrid deck had forced on itself, which is not a user choice.
    if (!sessionStatus?.filters) return false;
    return deckHasAppliedFilters(sessionStatus.filters, {
      hasSeries: capabilities.hasSeries,
      hybridCapable:
        capabilities.hasStreamingSettings && sessionStatus.provider === ProviderType.JELLYFIN,
      defaultSort: sessionStatus.provider === ProviderType.TMDB ? "Popular" : "Trending",
      // The dot only asks whether a stored value is a narrowing, so the library's
      // real year bounds are not needed: a stored range is always a choice.
      minYear: 1900,
      maxYear: new Date().getFullYear(),
      availableWatchProviderIds: [],
      settingsWatchProviders: userSettings?.watchProviders ?? [],
    });
  }, [sessionStatus, capabilities, userSettings]);

  const onSwipe = useCallback((id: string, direction: "left" | "right") => {
    // Check limits
    if (sessionSettings && stats) {
      if (direction === "right" && sessionSettings.maxRightSwipes && stats.mySwipes.right >= sessionSettings.maxRightSwipes) {
        toast.error("No likes left", { position: 'top-right', description: "Max number of likes reached" });
        return;
      }
      if (direction === "left" && sessionSettings.maxLeftSwipes && stats.mySwipes.left >= sessionSettings.maxLeftSwipes) {
        toast.error("No dislikes left", { position: 'top-right', description: "Max number of dislikes reached" });
        return;
      }
    }

    if (swipedIdsRef.current.has(id)) return;
    swipedIdsRef.current.add(id);
    setLastSwipe({ id, direction });
  }, [sessionSettings, stats]);

  const onCardLeftScreen = useCallback((id: string, direction: "left" | "right") => {
    if (!swipedIdsRef.current.has(id)) return;
    setRemovedIds((prev) => (prev.includes(id) ? prev : [...prev, id]));

    const item = displayDeck.find((i) => i.Id === id);
    if (!item) return;

    swipeMutation.mutate({ itemId: id, direction, item }, {
      onSuccess: (data) => {
        if (data.isMatch) {
          setMatchedItem({
            ...item,
            likedBy: data.likedBy
          });
        } else if (data.matchBlockedByLimit) {
          toast.error("Match not registered", {
            description: "Max number of matches reached",
            position: "top-right"
          });
        }
      },
      onError: (err) => {
        swipedIdsRef.current.delete(id);
        setRemovedIds(prev => prev.filter(rid => rid !== id));
        toast.error("Swipe failed", { description: getErrorMessage(err) });
      }
    });
  }, [displayDeck, swipeMutation]);

  const filteredDeck = useMemo(() => {
    return displayDeck.filter((item: MediaItem) => !removedIds.includes(item.Id));
  }, [displayDeck, removedIds]);

    const activeDeck = useMemo(() => {
    return filteredDeck.filter((item: MediaItem) => !swipedIdsRef.current.has(item.Id));
  }, [filteredDeck]);

  // Fetch next page when deck is running low
  useEffect(() => {
    if (activeDeck.length < 10 && hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  }, [activeDeck.length, hasNextPage, isFetchingNextPage, fetchNextPage]);

  useEffect(() => {
    const topItem = activeDeck[0];
    if (topItem) {
      setBackgroundItem({ id: topItem.Id, blurDataURL: topItem.BlurDataURL });
    } else {
      setBackgroundItem(null);
    }
  }, [activeDeck, setBackgroundItem]);

  const handleSwipeAction = (direction: "left" | "right") => {
    const topCard = activeDeck[0];
    if (topCard) {
      const ref = cardRefs.current[topCard.Id];
      if (ref?.current) {
        ref.current.swipe(direction);
      }
    }
  };

  const rewind = async () => {
    if (!lastSwipe) return;
    const { id, direction } = lastSwipe;
    
    try {
      await undoSwipeMutation.mutateAsync(id);
      setRewindingId({ id, direction });
      swipedIdsRef.current.delete(id);
      setRemovedIds(prev => prev.filter(rid => rid !== id));
      setLastSwipe(null);
    } catch (err) {
      toast.error("Undo failed");
    }
  };

  useEffect(() => {
    if (rewindingId) {
      const ref = cardRefs.current[rewindingId.id];
      if (ref?.current) {
        ref.current.restore(rewindingId.direction);
        setRewindingId(null);
      }
    }
  }, [rewindingId, activeDeck]);

  const updateFilters = (newFilters: Filters) => {
    updateSessionMutation.mutate({ filters: newFilters });
    setIsFilterOpen(false);
  };

  // Keyboard: every key the User Guide prints must exist here. A dialog owns the
  // keyboard while it is open (detail sheet, settings, the guide), otherwise a stray
  // `d` would like a card the reader cannot see.
  const deckReady = !isFilterOpen && activeDeck.length > 0;
  const whenNoDialog = (action: () => void) => () => {
    if (typeof document !== "undefined" && document.querySelector('[role="dialog"][data-state="open"]')) return;
    action();
  };

  useHotkeys("left", whenNoDialog(() => handleSwipeAction("left")), { enabled: deckReady });
  useHotkeys("right", whenNoDialog(() => handleSwipeAction("right")), { enabled: deckReady });
  useHotkeys("a", whenNoDialog(() => handleSwipeAction("left")), { enabled: deckReady });
  useHotkeys("d", whenNoDialog(() => handleSwipeAction("right")), { enabled: deckReady });
  useHotkeys("r, backspace", whenNoDialog(() => { void rewind(); }), { enabled: !isFilterOpen && !!lastSwipe });
  useHotkeys("enter, space", whenNoDialog(() => activeDeck[0] &&
    openMovie(activeDeck[0].Id, { showLikedBy: false, sessionCode })), { enabled: deckReady });
  // F opens the drawer; Escape (Radix) closes it, so the key never has to toggle
  // something the reader cannot currently see.
  useHotkeys("f", whenNoDialog(() => setIsFilterOpen(true)), { enabled: deckReady });
  useHotkeys("up", whenNoDialog(() => activeDeck[0] &&
    openMovie(activeDeck[0].Id, { showLikedBy: false, sessionCode })), { enabled: deckReady });

  /**
   * The top card is the one that gets opened. Warm its detail at idle so the sheet
   * opens with content instead of repainting a full-height subtree mid-slide.
   */
  const queryClient = useQueryClient();
  const topCardId = activeDeck[0]?.Id;
  useEffect(() => {
    if (!topCardId) return;
    const prefetch = () => {
      void queryClient.prefetchQuery(movieDetailQueryOptions(topCardId, sessionCode));
    };
    const idle = typeof window.requestIdleCallback === "function"
      ? window.requestIdleCallback(prefetch, { timeout: 2500 })
      : window.setTimeout(prefetch, 800);
    return () => {
      if (typeof window.cancelIdleCallback === "function") window.cancelIdleCallback(idle as number);
      else window.clearTimeout(idle as number);
    };
  }, [topCardId, sessionCode, queryClient]);

  if (isLoadingSession || isTransitioning || (activeDeck.length === 0 && (isLoading || isFetchingNextPage))) {
    return <DeckLoading />;
  }

  if (isErrorSession || isError) {
    return <DeckError />;
  }

  const leftSwipesRemaining = sessionSettings?.maxLeftSwipes ? Math.max(0, sessionSettings.maxLeftSwipes - (stats?.mySwipes.left || 0)) : undefined;
  const rightSwipesRemaining = sessionSettings?.maxRightSwipes ? Math.max(0, sessionSettings.maxRightSwipes - (stats?.mySwipes.right || 0)) : undefined;

  return (
    <div className="relative flex flex-col items-center justify-center w-full">
      {sessionStatus?.code && members && members.length > 0 ? (
        <div className="h-8.75">
          <UserAvatarList
            users={members.map((m) => ({ 
              userId: m.externalUserId, 
              userName: m.externalUserName,
              hasCustomProfilePicture: !!m.hasCustomProfilePicture,
              profileUpdatedAt: m.profileUpdatedAt
            }))}
            size="md"
          />
        </div>
      ) : <div className="h-8.75" />}
      <div className="relative w-full h-[68svh] flex justify-center items-center select-none">
        {activeDeck.length === 0 ? (
          <DeckEmpty deckMode={sessionFilters?.deckMode} onRefresh={() => {
            setRemovedIds([]);
            swipedIdsRef.current.clear();
            setDisplayDeck([]);
            refetch();
          }} onOpenFilter={() => setIsFilterOpen(true)} />
        ) : (
          <>
            {activeDeck.slice(0, 4).reverse().map((item: MediaItem, i, arr) => {
              const zIndex = arr.length - 1 - i;
              const prevent: ("left" | "right")[] = [];
              if (sessionSettings?.maxLeftSwipes && (stats?.mySwipes.left || 0) >= sessionSettings.maxLeftSwipes) prevent.push("left");
              if (sessionSettings?.maxRightSwipes && (stats?.mySwipes.right || 0) >= sessionSettings.maxRightSwipes) prevent.push("right");

              return (
                <SwipeCard
                  key={item.Id}
                  ref={getCardRef(item.Id)}
                  item={item}
                  index={zIndex}
                   onSwipe={onSwipe}
                   onCardLeftScreen={onCardLeftScreen}
                   onClick={() => openMovie(item.Id, { showLikedBy: false, sessionCode })}
                   preventSwipe={prevent}
                 />
              );
            })}
          </>
        )}
      </div>

      <DeckControls
        onRewind={rewind}
        onSwipeLeft={() => handleSwipeAction("left")}
        onSwipeRight={() => handleSwipeAction("right")}
        onOpenFilter={() => setIsFilterOpen(true)}
        canRewind={!!lastSwipe}
        hasAppliedFilters={hasAppliedFilters}
        leftSwipesRemaining={leftSwipesRemaining}
        rightSwipesRemaining={rightSwipesRemaining}
      />

      <div className="mt-3 w-full">
        <DeckHints />
      </div>

      <MatchOverlay
        item={matchedItem}
        sessionCode={sessionCode}
        onClose={() => setMatchedItem(null)}
      />

      <FilterDrawer
        open={isFilterOpen}
        onOpenChange={setIsFilterOpen}
        currentFilters={sessionFilters}
        onSave={updateFilters}
      />
    </div>
  );
}
