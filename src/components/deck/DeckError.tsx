import React from "react";
import { Button } from "@/components/ui/button";
import {
  ArrowsCounterClockwise,
  CardsThree,
} from "@phosphor-icons/react/dist/ssr";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";

export function DeckError({ isLetterboxd }: { isLetterboxd?: boolean }) {
  return (
    <div className="flex flex-col items-center justify-top h-[83vh] text-center text-muted-foreground ">
      <Empty className="from-muted/50 to-background h-full w-full bg-linear-to-b from-30% max-h-[67vh] mt-10 rounded-3xl">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <CardsThree className="rotate-[270deg]" />
          </EmptyMedia>
          <EmptyTitle className="text-foreground">{isLetterboxd ? "Could not load the Letterboxd watchlist." : "Something unexpected happened."}</EmptyTitle>
          <EmptyDescription>
            {isLetterboxd ? "Make sure the watchlist exists and is public, then reload." : "Reload the page to try again."}
          </EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              window.location.reload();
            }}>
            <ArrowsCounterClockwise />
            Reload
          </Button>
        </EmptyContent>
      </Empty>
    </div>
  );
}
