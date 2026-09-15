-- Prezzo originale al momento del salvataggio, immutabile — serve per mostrare la
-- variazione (🔺/🔻) quando l'utente riverifica manualmente un preferito più avanti.
-- "price" resta il prezzo più recente noto (aggiornato ad ogni riverifica).
alter table favorites add column if not exists original_price numeric;
update favorites set original_price = price where original_price is null;
alter table favorites alter column original_price set not null;
