import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";

// Risultati specifici salvati — tabella `favorites`.
export function useFavorites(userId) {
  const [favorites, setFavorites] = useState([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("favorites")
      .select("*")
      .eq("user_id", userId)
      .order("saved_at", { ascending: false });
    if (!error) setFavorites(data ?? []);
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    reload();
  }, [reload]);

  const addFavorite = useCallback(
    async (flightSnapshot) => {
      if (!userId) return;
      await supabase.from("favorites").insert({
        user_id: userId,
        flight_snapshot: flightSnapshot,
        price: flightSnapshot.price,
        currency: flightSnapshot.currency ?? "EUR",
        saved_at: new Date().toISOString(),
        is_fresh: true, // appena verificato al momento del salvataggio (nel dettaglio)
      });
      reload();
    },
    [userId, reload]
  );

  const removeFavorite = useCallback(
    async (id) => {
      await supabase.from("favorites").delete().eq("id", id);
      reload();
    },
    [reload]
  );

  const markVerified = useCallback(
    async (id, price) => {
      await supabase
        .from("favorites")
        .update({ price, is_fresh: true, last_verified_at: new Date().toISOString() })
        .eq("id", id);
      reload();
    },
    [reload]
  );

  return { favorites, loading, addFavorite, removeFavorite, markVerified };
}
