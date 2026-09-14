# Cheap Flights

App ricerca voli A/R più economico, destinazione e date libere. React + Vite, Supabase (DB + Auth + Edge Functions), Travelpayouts Data API.

## Setup

1. `npm install`
2. Copia `.env.example` in `.env`, riempi con URL/anon key del nuovo progetto Supabase (separato dal guardaroba).
3. Applica lo schema: `supabase db push` (o incolla `supabase/migrations/0001_init.sql` nel SQL editor Supabase).
4. Configura Google OAuth in Supabase → Authentication → Providers → Google (client ID/secret da Google Cloud Console, redirect URI = quella mostrata da Supabase).
5. Registrazione Travelpayouts (**da completare**, vedi sotto), poi:
   ```bash
   supabase secrets set TRAVELPAYOUTS_TOKEN=xxx
   supabase secrets set TRAVELPAYOUTS_MARKER=xxx
   ```
6. Deploy edge functions: `supabase functions deploy search-direct search-stopover verify-price`
7. `npm run dev`

## Stato registrazione Travelpayouts

Bloccata al passo "Crea progetto" (serve una URL). Da fare: creare/pubblicare il repo GitHub di questo progetto e usare quell'URL. Nel frattempo il codice ha placeholder (`TRAVELPAYOUTS_TOKEN`, `TRAVELPAYOUTS_MARKER`) pronti da riempire — l'app segnala errore chiaro finché mancano.

## Limite noto: "verifica prezzo"

Data API Travelpayouts è basata su cache, non realtime per singolo volo (quello è Real-Time Search API, scartata per requisiti commerciali). `verify-price` ri-interroga la cache più fresca disponibile + genera deep link Aviasales dove si vede il prezzo vero finale.
