import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { COLORS, RADIUS } from "../theme/colors";
import { Pill } from "../components/Pill";
import { PrimaryButton } from "../components/PrimaryButton";
import { FlagIcon } from "../components/FlagIcon";
import { useAuth } from "../hooks/useAuth";
import { useUserPreferences } from "../hooks/useUserPreferences";
import { countryName } from "../lib/countryNames";
import countryCodes from "../data/countryCodes.json";

const DEFAULT_ORIGIN = "BGY"; // Bergamo Orio al Serio

function Section({ label, children }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <div
        style={{
          fontSize: 12,
          fontWeight: 600,
          letterSpacing: "0.04em",
          textTransform: "uppercase",
          color: COLORS.inkSoft,
          marginBottom: 8,
        }}
      >
        {label}
      </div>
      {children}
    </div>
  );
}

function ToggleRow({ label, hint, value, onChange }) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        padding: "10px 0",
      }}
    >
      <div>
        <div style={{ fontSize: 13, color: COLORS.ink, fontWeight: 500 }}>{label}</div>
        {hint && <div style={{ fontSize: 11.5, color: COLORS.inkSoft }}>{hint}</div>}
      </div>
      <Pill tone={value ? "accent" : "neutral"} onClick={() => onChange(!value)}>
        {value ? "On" : "Off"}
      </Pill>
    </div>
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

export function Search() {
  const navigate = useNavigate();
  const { user } = useAuth();
  // A differenza degli altri filtri (per-sessione), i paesi esclusi sono legati
  // all'utente: caricati automaticamente qui e salvati ad ogni modifica.
  const { excludedCountries, setExcludedCountries } = useUserPreferences(user?.id);

  const [origins, setOrigins] = useState([DEFAULT_ORIGIN]);
  const [originInput, setOriginInput] = useState("");
  const [destination, setDestination] = useState(null); // null = "Ovunque"
  const [dateMode, setDateMode] = useState("anytime"); // "anytime" | "fixed"
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [nightsMin, setNightsMin] = useState("");
  const [nightsMax, setNightsMax] = useState("");
  const [flexDeparture, setFlexDeparture] = useState(false);
  const [flexArrival, setFlexArrival] = useState(false);
  const [countryInput, setCountryInput] = useState("");

  const addOrigin = () => {
    const code = originInput.trim().toUpperCase();
    if (code && !origins.includes(code)) setOrigins([...origins, code]);
    setOriginInput("");
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
    setOrigins([DEFAULT_ORIGIN]);
    setOriginInput("");
    setDestination(null);
    setDateMode("anytime");
    setDateFrom("");
    setDateTo("");
    setNightsMin("");
    setNightsMax("");
    setFlexDeparture(false);
    setFlexArrival(false);
    setCountryInput("");
    setExcludedCountries([]); // persiste subito anche lato server, come gli altri filtri
  };

  const runSearch = () => {
    const filters = {
      origins,
      destination, // null = ovunque
      dateMode,
      dateFrom: dateMode === "fixed" ? dateFrom : null,
      dateTo: dateMode === "fixed" ? dateTo : null,
      nightsMin: nightsMin === "" ? null : Number(nightsMin),
      nightsMax: nightsMax === "" ? null : Number(nightsMax),
      flexDeparture,
      flexArrival,
      excludedCountries,
    };
    navigate("/results", { state: { filters } });
  };

  return (
    <div style={{ padding: 20, paddingBottom: 100 }}>
      <Section label="Partenza">
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 8 }}>
          {origins.map((o) => (
            <Pill key={o} tone="accent" onClick={() => removeOrigin(o)}>
              {o} ✕
            </Pill>
          ))}
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <input
            value={originInput}
            onChange={(e) => setOriginInput(e.target.value)}
            placeholder="Codice IATA (es. MXP)"
            style={inputStyle}
          />
          <PrimaryButton onClick={addOrigin}>Aggiungi</PrimaryButton>
        </div>
      </Section>

      <Section label="Destinazione">
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <Pill tone={destination === null ? "accent" : "neutral"} onClick={() => setDestination(null)}>
            Ovunque
          </Pill>
          <Pill tone={destination !== null ? "accent" : "neutral"} onClick={() => setDestination("")}>
            Fissa
          </Pill>
        </div>
        {destination !== null && (
          <input
            value={destination}
            onChange={(e) => setDestination(e.target.value.toUpperCase())}
            placeholder="Codice IATA città o paese"
            style={{ ...inputStyle, marginTop: 8 }}
          />
        )}
      </Section>

      <Section label="Date">
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <Pill tone={dateMode === "anytime" ? "accent" : "neutral"} onClick={() => setDateMode("anytime")}>
            Sempre
          </Pill>
          <Pill tone={dateMode === "fixed" ? "accent" : "neutral"} onClick={() => setDateMode("fixed")}>
            Fisse
          </Pill>
        </div>
        {dateMode === "fixed" && (
          <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
            <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} style={inputStyle} />
            <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} style={inputStyle} />
          </div>
        )}
      </Section>

      <Section label="Durata soggiorno (notti)">
        <div style={{ display: "flex", gap: 8 }}>
          <input
            type="number"
            min={0}
            value={nightsMin}
            onChange={(e) => setNightsMin(e.target.value)}
            placeholder="Min"
            style={inputStyle}
          />
          <input
            type="number"
            min={0}
            value={nightsMax}
            onChange={(e) => setNightsMax(e.target.value)}
            placeholder="Max"
            style={inputStyle}
          />
        </div>
      </Section>

      <Section label="Flessibilità">
        <ToggleRow
          label="Ripartenza flessibile"
          hint="Ripartire da un aeroporto/paese diverso vicino alla destinazione, se conviene"
          value={flexDeparture}
          onChange={setFlexDeparture}
        />
        <ToggleRow
          label="Arrivo finale flessibile"
          hint="Atterrare in un aeroporto/paese diverso vicino a casa, se conviene"
          value={flexArrival}
          onChange={setFlexArrival}
        />
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
          display: "flex",
          gap: 10,
        }}
      >
        <PrimaryButton onClick={resetFilters}>Azzera filtri</PrimaryButton>
        <PrimaryButton
          variant="solid"
          onClick={runSearch}
          style={{ flex: 1, justifyContent: "center" }}
        >
          Cerca
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
