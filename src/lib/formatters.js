// Formattazioni condivise: date brevi in italiano e tempo relativo, usate in
// Preferiti/Storico al posto delle date ISO e dei timestamp assoluti.

const MONTHS_SHORT = ["gen", "feb", "mar", "apr", "mag", "giu", "lug", "ago", "set", "ott", "nov", "dic"];

export function formatDateRangeShort(fromIso, toIso) {
  if (!fromIso || !toIso) return "";
  const from = new Date(fromIso);
  const to = new Date(toIso);
  const sameMonth = from.getMonth() === to.getMonth() && from.getFullYear() === to.getFullYear();
  const toPart = `${to.getDate()} ${MONTHS_SHORT[to.getMonth()]}`;
  if (sameMonth) return `${from.getDate()}–${toPart}`;
  return `${from.getDate()} ${MONTHS_SHORT[from.getMonth()]}–${toPart}`;
}

export function formatRelativeTime(iso) {
  if (!iso) return "";
  const diffMs = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return "adesso";
  if (minutes < 60) return `${minutes} minut${minutes === 1 ? "o" : "i"} fa`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} or${hours === 1 ? "a" : "e"} fa`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} giorn${days === 1 ? "o" : "i"} fa`;
  const weeks = Math.floor(days / 7);
  if (weeks < 5) return `${weeks} settiman${weeks === 1 ? "a" : "e"} fa`;
  const months = Math.floor(days / 30);
  return `${months} mes${months === 1 ? "e" : "i"} fa`;
}
