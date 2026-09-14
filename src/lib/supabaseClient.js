import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  console.warn(
    "Supabase non configurato: copia .env.example in .env e inserisci URL/anon key del nuovo progetto."
  );
}

export const supabase = createClient(url, anonKey);
