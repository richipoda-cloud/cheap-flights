# Cheap Flights

App ricerca voli A/R più economico, destinazione e date libere. React + Vite, Supabase (DB + Auth + Edge Functions), Travelpayouts Data API.

Live: https://cheap-flights-zeta.vercel.app
Repo: https://github.com/richipoda-cloud/cheap-flights

## Setup (già fatto in produzione — per un nuovo ambiente)

1. `npm install`
2. Copia `.env.example` in `.env`, riempi con URL/anon key del progetto Supabase.
3. Applica lo schema: `supabase db push` (o incolla `supabase/migrations/0001_init.sql` nel SQL editor Supabase).
4. Configura Google OAuth in Supabase → Authentication → Providers → Google (client ID/secret da Google Cloud Console, redirect URI = quella mostrata da Supabase) e in Authentication → URL Configuration imposta Site URL + Redirect URLs sul dominio reale (Vercel), non su localhost.
5. `supabase secrets set TRAVELPAYOUTS_TOKEN=xxx TRAVELPAYOUTS_MARKER=xxx`
6. Deploy edge functions: `supabase functions deploy search-direct search-stopover verify-price`
7. `npm run dev`

## Limite noto: "verifica prezzo"

Data API Travelpayouts è basata su cache, non realtime per singolo volo (quello è Real-Time Search API, scartata per requisiti commerciali). `verify-price` ri-interroga la cache più fresca disponibile + genera deep link Aviasales dove si vede il prezzo vero finale.

## Limite noto: Percorsi creativi (scalo libero) danno pochi risultati

Un "percorso creativo" è modellato come due biglietti A/R separati (casa⇄hub, hub⇄destinazione), con vincolo obbligatorio che il secondo stia dentro la finestra di date del primo (altrimenti l'itinerario è fisicamente impossibile da seguire). Con dati reali, questo vincolo scarta quasi sempre le combinazioni economiche: i voli-hub più a buon mercato hanno finestre di soggiorno strette, quindi raramente contengono anche un secondo volo economico compatibile. Risultato: spesso "Nessun percorso alternativo conveniente trovato" — comportamento voluto (mai proporre un itinerario impossibile), non un bug.

**TODO futuro** (non urgente, refactor sostanziale): passare da round-trip aggregati nidificati a prezzi one-way (`one_way=true` su v2/prices/latest) per costruire i 4 tratti separatamente (casa→hub, hub→destinazione, destinazione→hub, hub→casa) — aumenterebbe molto le combinazioni valide trovabili, ma richiede riscrivere la logica di `search-stopover` e il modello dati dei risultati.
