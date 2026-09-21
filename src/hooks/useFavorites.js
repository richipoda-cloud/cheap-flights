import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { verifyPrice } from "../lib/api";

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

  // isFresh di default true: per i percorsi creativi (isStopover) non esiste un concetto
  // di "confermato" (niente singolo endpoint, vedi verifyFavorite sotto) — il prezzo è
  // comunque quello appena trovato in ricerca, va bene marcarlo fresco. Per un volo diretto
  // invece FlightDetail passa il vero esito della verifica: se non confermato (fallback sul
  // prezzo originale) non va marcato "✓ Prezzo aggiornato" fin da subito — stesso bug già
  // corretto sopra in verifyFavorite, qui era identico al primo salvataggio.
  const addFavorite = useCallback(
    async (flightSnapshot, isFresh = true) => {
      if (!userId) return;
      await supabase.from("favorites").insert({
        user_id: userId,
        flight_snapshot: flightSnapshot,
        price: flightSnapshot.price,
        original_price: flightSnapshot.price, // immutabile, per calcolare la variazione dopo
        currency: flightSnapshot.currency ?? "EUR",
        saved_at: new Date().toISOString(),
        is_fresh: isFresh,
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
    async (id, price, isFresh = true) => {
      await supabase
        .from("favorites")
        .update({ price, is_fresh: isFresh, last_verified_at: new Date().toISOString() })
        .eq("id", id);
      reload();
    },
    [reload]
  );

  // Riverifica manuale di un preferito già salvato — solo voli diretti: per i percorsi
  // creativi (più biglietti one-way) non esiste un singolo endpoint di verifica sensato,
  // andrebbero riverificati biglietto per biglietto (non fatto qui, fuori scope).
  //
  // is_fresh segue data.confirmed, non va messo sempre a true: se verify-price non ha
  // trovato un match reale (fallback sul prezzo originale non confermato), il badge non
  // deve dire "✓ Prezzo aggiornato" — stesso principio del fix su verify-price/confirmed.
  const verifyFavorite = useCallback(
    async (fav) => {
      const snapshot = fav.flight_snapshot;
      if (!snapshot || snapshot.isStopover) return null;
      const data = await verifyPrice(snapshot);
      const newPrice = data?.price ?? fav.price;
      await markVerified(fav.id, newPrice, Boolean(data?.confirmed));
      return newPrice;
    },
    [markVerified]
  );

  return { favorites, loading, addFavorite, removeFavorite, markVerified, verifyFavorite };
}
