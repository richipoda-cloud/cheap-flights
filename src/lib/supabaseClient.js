import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = Boolean(url && anonKey);

if (!isSupabaseConfigured) {
  console.warn(
    "Supabase non configurato: imposta VITE_SUPABASE_URL/VITE_SUPABASE_ANON_KEY (.env in locale, Environment Variables su Vercel)."
  );
}

// Se mancano le env var, createClient(url, key) lancerebbe subito ("supabaseUrl is required")
// e romperebbe l'intera app con una pagina bianca. Placeholder valido finché non configurato,
// così l'app può mostrare uno schermo di setup invece di crashare.
export const supabase = createClient(url || "https://placeholder.supabase.co", anonKey || "placeholder");
