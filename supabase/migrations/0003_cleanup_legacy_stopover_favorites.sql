-- Rimuove i preferiti salvati con uno schema "percorso creativo" precedente al refactor
-- a N tratte one-way (sia la primissima versione, senza leg1/leg2, sia quella intermedia
-- con leg1/leg2 fissi). Impronta comune a entrambe le versioni vecchie: presenza di
-- "viaHub" ma assenza di "legs" (mai vero né per voli diretti né per il nuovo schema).
delete from favorites where flight_snapshot ? 'viaHub' and not (flight_snapshot ? 'legs');
