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

## Limite noto: Percorsi creativi (scalo libero) possono dare pochi risultati

Un "percorso creativo" è modellato come N biglietti one-way indipendenti (già refactored da round-trip nidificati — vedi commit refactor one-way), con vincolo obbligatorio che ogni tratta stia dopo la precedente (altrimenti l'itinerario è fisicamente impossibile da seguire). A volte questo vincolo scarta comunque le combinazioni economiche trovate: comportamento voluto (mai proporre un itinerario impossibile), non un bug.

## TODO

- **Home da rivedere**: spaziatura sistemata (padding standard, card compatte), ma il layout/contenuto della schermata potrebbe avere altri aggiustamenti da valutare — non ancora considerata definitiva.
- Dedup preferiti: "Salva nei preferiti" non previene duplicati se cliccato più volte di seguito (bug noto minore, trovato durante l'audit mockup).
- "1 notti" invece di "1 notte" nei Risultati (plurale errato al singolare, trovato durante il redesign, mai corretto).
- **Audit visibilità toggle Altri filtri**: rivedere quando compare/scompare ciascuno dei 4 toggle flessibilità (Aeroporto di ritorno diverso dalla partenza, Ripartenza flessibile, Andata con scalo, Ritorno con scalo) a seconda di Ovunque/Destinazione fissa — richiesto esplicitamente dall'utente, non ancora fatto sistematicamente.
