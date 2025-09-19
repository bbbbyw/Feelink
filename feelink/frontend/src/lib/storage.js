const STORAGE_KEY = "feelinkJournal";

export function loadEntries() {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveEntries(entries) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  } catch {}
}

export function upsertEntryByDate(dateStr, entry) {
  const list = loadEntries();
  const idx = list.findIndex(e => e.date === dateStr);
  if (idx >= 0) list[idx] = { ...list[idx], ...entry };
  else list.push(entry);
  saveEntries(list);
  return list;
}

export function addEntry(entry) {
  const list = loadEntries();
  list.push(entry);
  saveEntries(list);
  return list;
} 