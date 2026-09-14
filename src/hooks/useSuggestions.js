import { useMemo } from "react";
import { useSearches } from "./useSearches";
import { useFavorites } from "./useFavorites";

// Suggerimenti derivati on-the-fly da searches (peso 1) + favorites (peso 3) —
// nessuna tabella dedicata, nessun tracciamento di prenotazioni esterne.
const FAVORITE_WEIGHT = 3;
const SEARCH_WEIGHT = 1;

export function useSuggestions(userId) {
  const { searches, loading: loadingSearches } = useSearches(userId);
  const { favorites, loading: loadingFavorites } = useFavorites(userId);

  const suggestions = useMemo(() => {
    const originCounts = new Map();
    const nightsCounts = new Map();

    const tally = (filters, weight) => {
      if (!filters) return;
      (filters.origins ?? []).forEach((o) => {
        originCounts.set(o, (originCounts.get(o) ?? 0) + weight);
      });
      if (filters.nightsMin != null && filters.nightsMax != null) {
        const key = `${filters.nightsMin}-${filters.nightsMax}`;
        nightsCounts.set(key, (nightsCounts.get(key) ?? 0) + weight);
      }
    };

    searches.forEach((s) => tally(s.filters, SEARCH_WEIGHT));
    favorites.forEach((f) => tally(f.flight_snapshot?.searchFilters, FAVORITE_WEIGHT));

    const topOrigins = [...originCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([origin]) => origin);

    const topNights = [...nightsCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

    // TODO: incrociare topOrigins/topNights con destinazioni salvate nei preferiti
    // per proporre card "Suggeriti per te" con motivazione esplicita.
    return { topOrigins, topNights };
  }, [searches, favorites]);

  return { suggestions, loading: loadingSearches || loadingFavorites };
}
