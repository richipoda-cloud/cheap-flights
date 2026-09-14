-- Storico combinazioni di filtri usate (non risultati)
create table if not exists searches (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  filters jsonb not null,
  created_at timestamptz not null default now()
);

-- Risultati specifici salvati dall'utente
create table if not exists favorites (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  flight_snapshot jsonb not null,
  price numeric not null,
  currency text not null default 'EUR',
  saved_at timestamptz not null default now(),
  last_verified_at timestamptz,
  is_fresh boolean not null default true
);

alter table searches enable row level security;
alter table favorites enable row level security;

create policy "searches: solo proprie" on searches
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "favorites: solo proprie" on favorites
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create index if not exists searches_user_id_idx on searches(user_id, created_at desc);
create index if not exists favorites_user_id_idx on favorites(user_id, saved_at desc);
