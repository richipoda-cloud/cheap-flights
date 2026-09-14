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

  const recordSearch = useCallback(
    async (filters) => {
      if (!userId) return;
      await supabase.from("searches").insert({ user_id: userId, filters });
      reload();
    },
    [userId, reload]
  );

  return { searches, loading, recordSearch, reload };
}
