import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { COLORS, RADIUS } from "../theme/colors";
import { Card } from "../components/Card";
import { Pill } from "../components/Pill";
import { Toggle } from "../components/Toggle";
import { DualRangeSlider, MIN_DAYS, MAX_DAYS } from "../components/DualRangeSlider";
import { PrimaryButton } from "../components/PrimaryButton";
import { FlagIcon } from "../components/FlagIcon";
import { useAuth } from "../hooks/useAuth";
import { useUserPreferences } from "../hooks/useUserPreferences";
import { countryName } from "../lib/countryNames";
import { cityName, resolveCityCode } from "../lib/cityNames";
import countryCodes from "../data/countryCodes.json";
import airports from "../data/airports.json";

// Suggerimenti di completamento per il campo Partenza — nome ufficiale di ognuno dei
// 9269 aeroporti del dataset Travelpayouts (non solo le città aggregate): digitando
// "Milano" ora compaiono sia "Milano Malpensa Airport" sia "Milano Linate Airport" come
// opzioni distinte, invece di un'unica voce generica per tutta la città. "Bergamo" resta
// aggiunto a parte perché il nome ufficiale dello scalo ("Orio al Serio International
// Airport") non contiene affatto la parola "Bergamo".
const ORIGIN_SUGGESTIONS = [...new Set([...airports.map((a) => a.name), "Bergamo"])];

function Section({ label, action, children }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <div
          style={{
            fontSize: 12,
            fontWeight: 600,
            letterSpacing: "0.04em",
            textTransform: "uppercase",
            color: COLORS.inkSoft,
          }}
        >
          {label}
        </div>
        {action}
      </div>
      {children}
    </div>
  );
}

// Due pill invece di un toggle: nessuna delle due è pre-selezionata finché l'utente
// non sceglie esplicitamente (usata per Destinazione e Date — niente default nascosto).
// Non riusa il Pill generico: il suo tono "accent" (sfondo accentSoft) è quasi identico
// allo sfondo pagina (#DCE3D3 vs #DBE4CC) e il selezionato spariva alla vista. Qui serve
// contrasto forte e inequivocabile: verde pieno + testo bianco quando selezionato.
function ChoicePills({ options, value, onChange }) {
  return (
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
      {options.map((opt) => {
        const selected = value === opt.value;
        return (
          <button
            key={String(opt.value)}
            onClick={() => onChange(opt.value)}
            style={{
              fontFamily: "'Inter', sans-serif",
              fontWeight: 600,
              fontSize: 12,
              letterSpacing: "0.02em",
              textTransform: "uppercase",
              padding: "9px 14px",
              borderRadius: RADIUS.pill,
              border: selected ? "none" : `1px solid ${COLORS.hairline}`,
              background: selected ? COLORS.accent : COLORS.surface,
              color: selected ? "#FFFFFF" : COLORS.inkSoft,
              boxShadow: selected ? "0 2px 6px rgba(33,30,43,0.2)" : "none",
              cursor: "pointer",
            }}
          >
            {opt.icon} {opt.label}
          </button>
        );
      })}
    </div>
  );
}

// Suggerimenti custom invece del <datalist> nativo: con ~9600 opzioni il datalist di
// sistema è inaffidabile (non compare affatto su alcuni browser mobile, altrove tronca
// silenziosamente la lista) — qui filtriamo e mostriamo noi il menu, sotto controllo.
function Autocomplete({ value, onChange, onPick, onKeyDown, suggestions, placeholder, style, autoFocus }) {
  const [open, setOpen] = useState(false);
  const query = value.trim().toLowerCase();
  const matches = query.length > 0 ? suggestions.filter((s) => s.toLowerCase().includes(query)).slice(0, 8) : [];

  return (
    <div style={{ position: "relative", flex: 1 }}>
      <input
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        style={{ ...style, width: "100%" }}
        autoFocus={autoFocus}
      />
      {open && matches.length > 0 && (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 4px)",
            left: 0,
            right: 0,
            background: COLORS.surface,
            border: `1px solid ${COLORS.hairline}`,
            borderRadius: RADIUS.button,
            boxShadow: "0 4px 12px rgba(33,30,43,0.15)",
            zIndex: 30,
            maxHeight: 220,
            overflowY: "auto",
          }}
        >
          {matches.map((m) => (
            <div
              key={m}
              onMouseDown={() => {
                onPick(m);
                setOpen(false);
              }}
              style={{ padding: "9px 12px", fontSize: 13, color: COLORS.ink, cursor: "pointer" }}
            >
              {m}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// Riga icona+label+sublabel a sinistra, Toggle iOS a destra — per le due Flessibilità.
function ToggleRow({ label, hint, checked, onChange }) {
  return (
    <Card style={{ padding: 14, marginBottom: 8 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 600, color: COLORS.ink }}>{label}</div>
          {hint && <div style={{ fontSize: 12, color: COLORS.inkSoft }}>{hint}</div>}
        </div>
        <Toggle checked={checked} onChange={onChange} />
      </div>
    </Card>
  );
}

// Menu a tenda in fondo: raggruppa i filtri secondari (flessibilità, paesi esclusi)
// fuori dal flusso principale Partenza/Destinazione/Date, chiuso di default.
function Accordion({ title, children }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ marginBottom: 20 }}>
      <div
        onClick={() => setOpen(!open)}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 4,
          width: "fit-content",
          cursor: "pointer",
        }}
      >
        <span style={{ fontSize: 12, fontWeight: 600, color: COLORS.accent }}>{title}</span>
        <span
          style={{
            fontSize: 12,
            color: COLORS.accent,
            transform: open ? "rotate(180deg)" : "none",
            transition: "transform 0.2s",
          }}
        >
          ▾
        </span>
      </div>
      {open && <div style={{ marginTop: 12 }}>{children}</div>}
    </div>
  );
}

// Nome->codice via Intl.DisplayNames costruito una volta sola (237 paesi, costo trascurabile).
const NAME_TO_CODE = Object.fromEntries(countryCodes.map((code) => [countryName(code).toLowerCase(), code]));
const CODE_SET = new Set(countryCodes.map((c) => c.toLowerCase()));

// Nomi comuni/informali che non sono il nome ufficiale ISO restituito da Intl.DisplayNames
// (es. "Regno Unito" non "Inghilterra") — lista curata dei casi più frequenti, non di
// ogni possibile nickname/regione di ogni paese (non generalizzabile ai 237 paesi ISO).
const COUNTRY_NICKNAMES = {
  inghilterra: "GB",
  scozia: "GB",
  galles: "GB",
  "gran bretagna": "GB",
  olanda: "NL",
  "repubblica ceca": "CZ",
  "stati uniti d'america": "US",
  usa: "US",
  america: "US",
  "emirati arabi": "AE",
  dubai: "AE",
  "corea del sud": "KR",
  "corea del nord": "KP",
  birmania: "MM",
};

function resolveCountryCode(input) {
  const q = input.trim().toLowerCase();
  if (!q) return null;
  if (CODE_SET.has(q)) return q.toUpperCase();
  if (COUNTRY_NICKNAMES[q]) return COUNTRY_NICKNAMES[q];
  return NAME_TO_CODE[q] ?? null;
}

// Filtri "sticky" nel browser: restano quelli dell'ultima ricerca finché non si preme
// "Azzera filtri", anche navigando via e tornando su Cerca voli (a differenza di
// Escludi paesi, che è legato all'account su Supabase, questo è solo locale).
// destination/dateMode partono undefined (non "Ovunque"/"Sempre" preimpostati) — vanno
// scelti esplicitamente, come la partenza.
const STORAGE_KEY = "cheapflights_search_filters";
const DEFAULT_FILTERS = {
  origins: [],
  destination: undefined,
  dateMode: undefined,
  dateFrom: "",
  dateTo: "",
  daysMin: MIN_DAYS,
  daysMax: MAX_DAYS,
  flexDeparture: false,
  flexArrival: false,
  flexOutboundStop: false,
  flexReturnStop: false,
};

function loadPersistedFilters() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? { ...DEFAULT_FILTERS, ...JSON.parse(raw) } : DEFAULT_FILTERS;
  } catch {
    return DEFAULT_FILTERS;
  }
}

export function Search() {
  const navigate = useNavigate();
  const { user } = useAuth();
  // A differenza degli altri filtri (per-sessione), i paesi esclusi sono legati
  // all'utente: caricati automaticamente qui e salvati ad ogni modifica.
  const { excludedCountries, setExcludedCountries, loading: prefsLoading } = useUserPreferences(user?.id);

  const [origins, setOrigins] = useState(() => loadPersistedFilters().origins);
  const [originInput, setOriginInput] = useState("");
  const [addingOrigin, setAddingOrigin] = useState(false); // mostra il campo per aggiungerne altre dopo la prima
  const [destination, setDestination] = useState(() => loadPersistedFilters().destination);
  const [dateMode, setDateMode] = useState(() => loadPersistedFilters().dateMode);
  const [dateFrom, setDateFrom] = useState(() => loadPersistedFilters().dateFrom);
  const [dateTo, setDateTo] = useState(() => loadPersistedFilters().dateTo);
  const [daysMin, setDaysMinState] = useState(() => loadPersistedFilters().daysMin);
  const [daysMax, setDaysMaxState] = useState(() => loadPersistedFilters().daysMax);
  const [flexDeparture, setFlexDeparture] = useState(() => loadPersistedFilters().flexDeparture);
  const [flexArrival, setFlexArrival] = useState(() => loadPersistedFilters().flexArrival);
  const [flexOutboundStop, setFlexOutboundStop] = useState(() => loadPersistedFilters().flexOutboundStop);
  const [flexReturnStop, setFlexReturnStop] = useState(() => loadPersistedFilters().flexReturnStop);
  const [countryInput, setCountryInput] = useState("");

  useEffect(() => {
    const state = {
      origins,
      destination,
      dateMode,
      dateFrom,
      dateTo,
      daysMin,
      daysMax,
      flexDeparture,
      flexArrival,
      flexOutboundStop,
      flexReturnStop,
    };
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // storage non disponibile (privata/bloccato): i filtri restano solo per la sessione corrente
    }
  }, [
    origins,
    destination,
    dateMode,
    dateFrom,
    dateTo,
    daysMin,
    daysMax,
    flexDeparture,
    flexArrival,
    flexOutboundStop,
    flexReturnStop,
  ]);

  const [originError, setOriginError] = useState(null);

  // Passando a "Date fisse" il campo "da" non deve apparire vuoto: default oggi.
  // Il campo "a" resta derivato dalla durata soggiorno (vedi effect sotto) — così
  // segue lo slider anche se lo si cambia DOPO aver già scelto le date fisse.
  const handleDateModeChange = (mode) => {
    setDateMode(mode);
    if (mode === "fixed" && !dateFrom) {
      setDateFrom(new Date().toISOString().slice(0, 10));
    }
  };

  // Tiene "a" sempre allineato a "da" + durata soggiorno minima corrente, invece di
  // calcolarlo una sola volta al momento dello switch (bug: restava fisso anche
  // spostando poi lo slider della durata).
  useEffect(() => {
    if (dateMode !== "fixed" || !dateFrom) return;
    const to = new Date(dateFrom + "T00:00:00");
    to.setDate(to.getDate() + daysMin);
    setDateTo(to.toISOString().slice(0, 10));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateMode, dateFrom, daysMin]);

  const addOrigin = () => {
    const code = resolveCityCode(originInput);
    if (!code) {
      setOriginError(`"${originInput}" non riconosciuto — scrivi il nome della città o il codice IATA`);
      return;
    }
    if (!origins.includes(code)) setOrigins([...origins, code]);
    setOriginInput("");
    setOriginError(null);
    setAddingOrigin(false);
  };

  const removeOrigin = (code) => setOrigins(origins.filter((o) => o !== code));

  // Guardia anti-race: se l'elenco paesi esclusi non ha ancora finito di caricare dal
  // server, aggiungerne uno adesso scriverebbe [nuovo] sopra il valore vero non ancora
  // arrivato, cancellando di fatto quelli salvati in precedenza (bug: "spariscono").
  const addExcludedCountry = () => {
    if (prefsLoading) return;
    const code = resolveCountryCode(countryInput);
    if (code && !excludedCountries.includes(code)) {
      setExcludedCountries([...excludedCountries, code]);
    }
    setCountryInput("");
  };

  const removeExcludedCountry = (code) => {
    if (prefsLoading) return;
    setExcludedCountries(excludedCountries.filter((c) => c !== code));
  };

  const resetFilters = () => {
    setOrigins([]);
    setOriginInput("");
    setAddingOrigin(false);
    setDestination(undefined);
    setDateMode(undefined);
    setDateFrom("");
    setDateTo("");
    setDaysMinState(MIN_DAYS);
    setDaysMaxState(MAX_DAYS);
    setFlexDeparture(false);
    setFlexArrival(false);
    setFlexOutboundStop(false);
    setFlexReturnStop(false);
    setCountryInput("");
    if (!prefsLoading) setExcludedCountries([]); // persiste subito anche lato server, come gli altri filtri
  };

  const canSearch =
    origins.length > 0 &&
    destination !== undefined &&
    (destination === null || destination.length > 0) &&
    dateMode !== undefined &&
    (dateMode !== "fixed" || (dateFrom && dateTo));

  const runSearch = () => {
    if (!canSearch) return;
    // Slider = giorni (1 = A/R in giornata, 0 notti); il filtro reale è in notti = giorni-1.
    // Range pieno (default) = nessun limite.
    const noLimit = daysMin === MIN_DAYS && daysMax === MAX_DAYS;
    const filters = {
      origins,
      destination, // null = ovunque
      dateMode,
      dateFrom: dateMode === "fixed" ? dateFrom : null,
      dateTo: dateMode === "fixed" ? dateTo : null,
      nightsMin: noLimit ? null : daysMin - 1,
      nightsMax: noLimit ? null : daysMax - 1,
      flexDeparture,
      flexArrival,
      flexOutboundStop,
      flexReturnStop,
      excludedCountries,
    };
    navigate("/results", { state: { filters } });
  };

  return (
    <div style={{ padding: 20, paddingBottom: 220 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <div style={{ fontWeight: 600, fontSize: 22, color: COLORS.ink }}>Cerca voli</div>
        <button
          onClick={resetFilters}
          style={{
            fontFamily: "'Inter', sans-serif",
            fontWeight: 600,
            fontSize: 11.5,
            letterSpacing: "0.06em",
            textTransform: "uppercase",
            color: COLORS.plum,
            background: COLORS.surface,
            border: `1px solid ${COLORS.hairline}`,
            borderRadius: RADIUS.pill,
            padding: "3px 10px",
            cursor: "pointer",
          }}
        >
          Azzera
        </button>
      </div>

      <Section
        label="Partenza"
        action={
          origins.length > 0 && !addingOrigin ? (
            <span
              onClick={() => setAddingOrigin(true)}
              style={{ fontSize: 12, fontWeight: 600, color: COLORS.accent, cursor: "pointer" }}
            >
              + Aggiungi
            </span>
          ) : null
        }
      >
        {origins.length === 0 && (
          <div style={{ fontSize: 12, color: COLORS.inkSoft, marginBottom: 8 }}>
            Aggiungi almeno un aeroporto di partenza (es. BGY per Bergamo)
          </div>
        )}
        {origins.map((o) => (
          <Card key={o} style={{ padding: 14, marginBottom: 8 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontSize: 20 }}>✈️</span>
                <div style={{ fontSize: 14, fontWeight: 600, color: COLORS.ink }}>
                  {cityName(o)} ({o})
                </div>
              </div>
              <span onClick={() => removeOrigin(o)} style={{ color: COLORS.inkSoft, cursor: "pointer" }}>
                ✕
              </span>
            </div>
          </Card>
        ))}
        {(origins.length === 0 || addingOrigin) && (
          <>
            <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
              <Autocomplete
                value={originInput}
                onChange={(v) => {
                  setOriginInput(v);
                  setOriginError(null);
                }}
                onPick={(name) => setOriginInput(name)}
                onKeyDown={(e) => e.key === "Enter" && addOrigin()}
                suggestions={ORIGIN_SUGGESTIONS}
                placeholder="Città o codice IATA (es. Bergamo, MXP)"
                style={inputStyle}
                autoFocus={addingOrigin}
              />
              <PrimaryButton onClick={addOrigin}>Aggiungi</PrimaryButton>
            </div>
            {originError && (
              <div style={{ fontSize: 11.5, color: COLORS.warn, marginTop: 6 }}>{originError}</div>
            )}
          </>
        )}
      </Section>

      <Section label="Destinazione">
        <ChoicePills
          options={[
            { value: null, icon: "🌍", label: "Ovunque" },
            { value: "", icon: "📍", label: "Destinazione fissa" },
          ]}
          value={destination}
          onChange={(value) => {
            setDestination(value);
            // "Ripartenza flessibile" ha senso solo con una destinazione precisa (serve
            // per trovare aeroporti vicini a QUELLA destinazione) — passando a Ovunque
            // il toggle sparisce dall'interfaccia, e va anche spento qui sotto.
            if (value === null) setFlexDeparture(false);
          }}
        />
        {destination !== undefined && destination !== null && (
          <input
            value={destination}
            onChange={(e) => setDestination(e.target.value.toUpperCase())}
            placeholder="Codice IATA città o paese"
            style={{ ...inputStyle, width: "100%", marginTop: 8 }}
          />
        )}
      </Section>

      <Section label="Durata soggiorno">
        <Card style={{ padding: 16 }}>
          <DualRangeSlider
            min={daysMin}
            max={daysMax}
            onChange={(lo, hi) => {
              setDaysMinState(lo);
              setDaysMaxState(hi);
            }}
          />
        </Card>
      </Section>

      <Section label="Date">
        <ChoicePills
          options={[
            { value: "anytime", icon: "🎫", label: "Sempre" },
            { value: "fixed", icon: "📅", label: "Date fisse" },
          ]}
          value={dateMode}
          onChange={handleDateModeChange}
        />
        {dateMode === "fixed" && (
          <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
            <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} style={inputStyle} />
            <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} style={inputStyle} />
          </div>
        )}
      </Section>

      <Accordion title="Altri filtri">
        <ToggleRow
          label="Aeroporto di ritorno diverso dalla partenza"
          hint="Se conviene, il ritorno atterra su un altro dei tuoi aeroporti di partenza invece di quello di andata"
          checked={flexArrival}
          onChange={setFlexArrival}
        />
        {destination !== undefined && destination !== null && (
          <ToggleRow
            label="Ripartenza flessibile"
            hint="Se conviene, riparti da un aeroporto diverso vicino alla destinazione"
            checked={flexDeparture}
            onChange={setFlexDeparture}
          />
        )}
        <ToggleRow
          label="Andata con scalo"
          hint="Se conviene, l'andata può avere uno scalo intermedio invece del volo diretto"
          checked={flexOutboundStop}
          onChange={setFlexOutboundStop}
        />
        <ToggleRow
          label="Ritorno con scalo"
          hint="Se conviene, il ritorno può avere uno scalo intermedio invece del volo diretto"
          checked={flexReturnStop}
          onChange={setFlexReturnStop}
        />

        <div style={{ fontSize: 12, fontWeight: 600, letterSpacing: "0.04em", textTransform: "uppercase", color: COLORS.inkSoft, marginTop: 12, marginBottom: 8 }}>
          Escludi paesi
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <input
            list="country-options"
            value={countryInput}
            onChange={(e) => setCountryInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addExcludedCountry()}
            placeholder={prefsLoading ? "Caricamento…" : "Nome paese (es. Francia)"}
            disabled={prefsLoading}
            style={inputStyle}
          />
          <datalist id="country-options">
            {countryCodes.map((code) => (
              <option key={code} value={countryName(code)} />
            ))}
          </datalist>
          <PrimaryButton onClick={addExcludedCountry} disabled={prefsLoading}>
            Escludi
          </PrimaryButton>
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 8 }}>
          {excludedCountries.map((code) => (
            <Pill key={code} onClick={() => removeExcludedCountry(code)}>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                <FlagIcon countryCode={code} size={12} /> {countryName(code)} ✕
              </span>
            </Pill>
          ))}
        </div>
      </Accordion>

      <div
        style={{
          position: "fixed",
          // Sopra la tab bar (fissa in fondo su tutte le schermate tranne Home), non più
          // attaccato al bordo — altrimenti le due barre fisse si sovrapporrebbero.
          bottom: "calc(max(28px, env(safe-area-inset-bottom)) + 112px)",
          left: 0,
          right: 0,
          padding: 16,
          background: COLORS.bg,
          borderTop: `1px solid ${COLORS.hairline}`,
        }}
      >
        <PrimaryButton
          variant="solid"
          onClick={runSearch}
          disabled={!canSearch}
          style={{ width: "100%", justifyContent: "center", gap: 8 }}
        >
          🔍 Trova il più economico
        </PrimaryButton>
      </div>
    </div>
  );
}

const inputStyle = {
  fontFamily: "'Inter', sans-serif",
  fontSize: 13,
  padding: "10px 12px",
  borderRadius: RADIUS.button,
  border: `1px solid ${COLORS.hairline}`,
  flex: 1,
  color: COLORS.ink,
  background: COLORS.surface,
};
