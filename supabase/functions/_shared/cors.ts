// Header CORS condivisi — necessari perché il browser chiama le Edge Function
// direttamente dal client (fetch cross-origin da Vercel a *.supabase.co).
export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
