import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";

// Storico combinazioni di filtri (non risultati) — tabella `searches`.
export function useSearches(userId) {
  const [searches, setSearches] = useState([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("searches")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });
    if (!error) setSearches(data ?? []);
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    reload();
  }, [reload]);

  // Ritorna la riga inserita (serve l'id per poterla aggiornare in seguito, vedi
  // attachResultDestinations) — prima non veniva restituito nulla perché non serviva.
  const recordSearch = useCallback(
    async (filters) => {
      if (!userId) return null;
      const { data } = await supabase
        .from("searches")
        .insert({ user_id: userId, filters })
        .select()
        .single();
      reload();
      return data ?? null;
    },
    [userId, reload]
  );

  // Aggiunge a posteriori, dentro lo stesso JSON `filters` (nessuna migrazione schema),
  // i codici delle destinazioni trovate per una ricerca "Ovunque" — usati poi in Home per
  // far ruotare la foto hero tra quelle destinazioni invece di restare sempre sul default.
  // Chiave interna "_resultDestinations", ignorata da describeLastSearch e dal resto
  // della UI che legge solo i campi dei filtri veri e propri.
  const attachResultDestinations = useCallback(
    async (searchId, filters, codes) => {
      if (!searchId || !codes || codes.length === 0) return;
      await supabase
        .from("searches")
        .update({ filters: { ...filters, _resultDestinations: codes } })
        .eq("id", searchId);
      reload();
    },
    [reload]
  );

  const removeSearch = useCallback(
    async (id) => {
      await supabase.from("searches").delete().eq("id", id);
      reload();
    },
    [reload]
  );

  const removeAllSearches = useCallback(async () => {
    if (!userId) return;
    await supabase.from("searches").delete().eq("user_id", userId);
    reload();
  }, [userId, reload]);

  return {
    searches,
    loading,
    recordSearch,
    attachResultDestinations,
    removeSearch,
    removeAllSearches,
    reload,
  };
}
