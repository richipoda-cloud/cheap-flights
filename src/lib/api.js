// Wrapper verso le Edge Function Supabase — mai chiamare Travelpayouts diretto dal client
// (il token resta lato server, letto da Deno.env in supabase/functions/*).
import { supabase } from "./supabaseClient";

async function invoke(name, body) {
  const { data, error } = await supabase.functions.invoke(name, { body });
  if (error) throw error;
  return data;
}

// filters: { origins: string[], destination: string|null ("ovunque" se null),
//   dateFrom, dateTo, nightsMin, nightsMax, flexDeparture, flexArrival }
export function searchDirect(filters) {
  return invoke("search-direct", filters);
}

export function searchStopover(filters) {
  return invoke("search-stopover", filters);
}

// flightId/snapshot del volo da riverificare in tempo reale, unica fonte di prezzo confermato
export function verifyPrice(flightSnapshot) {
  return invoke("verify-price", flightSnapshot);
}
