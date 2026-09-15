-- Preferenze persistenti dell'utente (a differenza di searches/favorites, qui c'è
-- una sola riga per utente che si aggiorna in-place). Per ora solo i paesi esclusi
-- sempre dai risultati di ricerca (diretti + percorsi creativi).
create table if not exists user_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  excluded_countries text[] not null default '{}',
  updated_at timestamptz not null default now()
);

alter table user_preferences enable row level security;

create policy "user_preferences: solo proprie" on user_preferences
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
