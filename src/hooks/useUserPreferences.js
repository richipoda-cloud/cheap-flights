import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";

// Preferenze persistenti dell'utente — a differenza degli altri filtri di ricerca
// (che sono per-sessione), i paesi esclusi vanno salvati e ricaricati automaticamente
// ad ogni apertura della schermata di ricerca, legati all'utente (non al browser).
export function useUserPreferences(userId) {
  const [excludedCountries, setExcludedCountriesState] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    supabase
      .from("user_preferences")
      .select("excluded_countries")
      .eq("user_id", userId)
      .maybeSingle()
      .then(({ data }) => {
        setExcludedCountriesState(data?.excluded_countries ?? []);
        setLoading(false);
      });
  }, [userId]);

  // Salva subito ad ogni modifica (non solo al "Cerca"): così resta sincronizzato
  // anche se l'utente lascia la schermata senza lanciare una ricerca.
  const setExcludedCountries = useCallback(
    async (codes) => {
      setExcludedCountriesState(codes);
      if (!userId) return;
      await supabase.from("user_preferences").upsert({
        user_id: userId,
        excluded_countries: codes,
        updated_at: new Date().toISOString(),
      });
    },
    [userId]
  );

  return { excludedCountries, setExcludedCountries, loading };
}
