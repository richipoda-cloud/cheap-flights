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
import { cityName } from "../lib/cityNames";
import countryCodes from "../data/countryCodes.json";

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
function ChoicePills({ options, value, onChange }) {
  return (
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
      {options.map((opt) => (
        <Pill key={opt.value} tone={value === opt.value ? "accent" : "neutral"} onClick={() => onChange(opt.value)}>
          {opt.icon} {opt.label}
        </Pill>
      ))}
    </div>
  );
}

// Riga icona+label+sublabel a sinistra, Toggle iOS a destra — per le due Flessibilità.
function ToggleRow({ label, hint, checked, onChange }) {
  return (
    <Card style={{ padding: 14, marginTop: 8 }}>
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

// Nome->codice via Intl.DisplayNames costruito una volta sola (237 paesi, costo trascurabile).
const NAME_TO_CODE = Object.fromEntries(countryCodes.map((code) => [countryName(code).toLowerCase(), code]));
const CODE_SET = new Set(countryCodes.map((c) => c.toLowerCase()));

function resolveCountryCode(input) {
  const q = input.trim().toLowerCase();
  if (!q) return null;
  if (CODE_SET.has(q)) return q.toUpperCase();
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
  const { excludedCountries, setExcludedCountries } = useUserPreferences(user?.id);

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
  const [countryInput, setCountryInput] = useState("");

  useEffect(() => {
    const state = { origins, destination, dateMode, dateFrom, dateTo, daysMin, daysMax, flexDeparture, flexArrival };
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // storage non disponibile (privata/bloccato): i filtri restano solo per la sessione corrente
    }
  }, [origins, destination, dateMode, dateFrom, dateTo, daysMin, daysMax, flexDeparture, flexArrival]);

  const addOrigin = () => {
    const code = originInput.trim().toUpperCase();
    if (code && !origins.includes(code)) setOrigins([...origins, code]);
    setOriginInput("");
    setAddingOrigin(false);
  };

  const removeOrigin = (code) => setOrigins(origins.filter((o) => o !== code));

  const addExcludedCountry = () => {
    const code = resolveCountryCode(countryInput);
    if (code && !excludedCountries.includes(code)) {
      setExcludedCountries([...excludedCountries, code]);
    }
    setCountryInput("");
  };

  const removeExcludedCountry = (code) =>
    setExcludedCountries(excludedCountries.filter((c) => c !== code));

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
    setCountryInput("");
    setExcludedCountries([]); // persiste subito anche lato server, come gli altri filtri
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
      excludedCountries,
    };
    navigate("/results", { state: { filters } });
  };

  return (
    <div style={{ padding: 20, paddingBottom: 100 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <div style={{ fontWeight: 600, fontSize: 22, color: COLORS.ink }}>Cerca voli</div>
        <span
          onClick={resetFilters}
          style={{ fontSize: 13, fontWeight: 600, color: COLORS.plum, cursor: "pointer" }}
        >
          Azzera
        </span>
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
          <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
            <input
              value={originInput}
              onChange={(e) => setOriginInput(e.target.value)}
              placeholder="Codice IATA (es. MXP)"
              style={inputStyle}
              autoFocus={addingOrigin}
            />
            <PrimaryButton onClick={addOrigin}>Aggiungi</PrimaryButton>
          </div>
        )}
        <ToggleRow
          label="Arrivo finale flessibile"
          hint="Se conviene, atterra in un aeroporto diverso vicino a casa"
          checked={flexArrival}
          onChange={setFlexArrival}
        />
      </Section>

      <Section label="Destinazione">
        <ChoicePills
          options={[
            { value: null, icon: "🌍", label: "Ovunque" },
            { value: "", icon: "📍", label: "Destinazione fissa" },
          ]}
          value={destination}
          onChange={setDestination}
        />
        {destination !== undefined && destination !== null && (
          <input
            value={destination}
            onChange={(e) => setDestination(e.target.value.toUpperCase())}
            placeholder="Codice IATA città o paese"
            style={{ ...inputStyle, width: "100%", marginTop: 8 }}
          />
        )}
        <ToggleRow
          label="Ripartenza flessibile"
          hint="Se conviene, riparti da un aeroporto diverso vicino alla destinazione"
          checked={flexDeparture}
          onChange={setFlexDeparture}
        />
      </Section>

      <Section label="Date">
        <ChoicePills
          options={[
            { value: "anytime", icon: "🎫", label: "Sempre" },
            { value: "fixed", icon: "📅", label: "Date fisse" },
          ]}
          value={dateMode}
          onChange={setDateMode}
        />
        {dateMode === "fixed" && (
          <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
            <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} style={inputStyle} />
            <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} style={inputStyle} />
          </div>
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

      <Section label="Escludi paesi">
        <div style={{ fontSize: 11.5, color: COLORS.inkSoft, marginBottom: 8 }}>
          Salvato sul tuo account — resta impostato anche nelle prossime ricerche
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 8 }}>
          {excludedCountries.map((code) => (
            <Pill key={code} tone="plum" onClick={() => removeExcludedCountry(code)}>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                <FlagIcon countryCode={code} size={12} /> {countryName(code)} ✕
              </span>
            </Pill>
          ))}
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <input
            list="country-options"
            value={countryInput}
            onChange={(e) => setCountryInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addExcludedCountry()}
            placeholder="Nome paese (es. Francia)"
            style={inputStyle}
          />
          <datalist id="country-options">
            {countryCodes.map((code) => (
              <option key={code} value={countryName(code)} />
            ))}
          </datalist>
          <PrimaryButton onClick={addExcludedCountry}>Escludi</PrimaryButton>
        </div>
      </Section>

      <div
        style={{
          position: "fixed",
          bottom: 0,
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
