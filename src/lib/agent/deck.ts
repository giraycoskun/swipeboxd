/**
 * Why a deck is empty.
 *
 * This is the machine version of the question that costs maintainers their
 * evenings: the app renders an empty deck and says nothing, because the reason
 * (no credential, an excluded library, a provider that never answered, an
 * exhausted deck) all collapse into the same empty list. `deck?why=1` separates
 * them, and every entry names the fix.
 */
export type DeckDiagnosisSeverity = "ok" | "info" | "warning" | "error";

export interface DeckDiagnosis {
  code: string;
  severity: DeckDiagnosisSeverity;
  message: string;
  fix?: string;
}

export interface DeckDiagnosisInput {
  /** Library ids the provider reports. */
  libraryIds: string[];
  /** The admin's inclusion list. Empty means *everything*, not nothing. */
  includedLibraries: string[];
  /** Cards the deck returned. */
  returned: number;
  /** Items this member has already swiped (liked or hidden). */
  swiped: number;
  /** Set when the provider call threw; the diagnosis replaces the count logic. */
  providerError?: string | null;
}

export function diagnoseDeck(input: DeckDiagnosisInput): DeckDiagnosis[] {
  if (input.providerError) {
    return [
      {
        code: "PROVIDER_UNREACHABLE",
        severity: "error",
        message: `The media server did not answer: ${input.providerError}`,
        fix: "Check the provider URL and that its API is reachable from the container (docker exec <container> messer-swipe diag).",
      },
    ];
  }

  const includedIsEverything = input.includedLibraries.length === 0;
  const effective =
    includedIsEverything
      ? input.libraryIds
      : input.libraryIds.filter((id) => input.includedLibraries.includes(id));

  if (!includedIsEverything && input.libraryIds.length > 0 && effective.length === 0) {
    return [
      {
        code: "ALL_LIBRARIES_EXCLUDED",
        severity: "error",
        message: "Every library is excluded, so the deck has nothing to draw from.",
        fix: "Settings → Admin → Libraries: include at least one.",
      },
    ];
  }

  if (input.returned > 0) {
    return [
      {
        code: "OK",
        severity: "ok",
        message: `${input.returned} card(s) available.`,
        ...(includedIsEverything
          ? {}
          : { fix: `${effective.length} of ${input.libraryIds.length} libraries are included.` }),
      },
    ];
  }

  if (input.swiped > 0) {
    return [
      {
        code: "DECK_EXHAUSTED",
        severity: "warning",
        message: `No candidates left; this member has already swiped ${input.swiped} item(s).`,
        fix: "Clear the member's swipes (Settings → Danger Zone, or the admin API) if you expected more.",
      },
    ];
  }

  return [
    {
      code: "NO_CANDIDATES",
      severity: "warning",
      message: "The provider answered, but returned no items that pass the filters.",
      fix: "Check the library contents and the deck mode; an empty library, or a genre/year filter that excludes everything, both land here.",
    },
  ];
}
