const STORAGE_KEY = "feelink_mood_history";

export function saveMood(entry) {
  try {
    const existing = getMoods();
    const index = existing.findIndex(e => e.date === entry.date);
    
    if (index >= 0) {
      existing[index] = { ...existing[index], ...entry };
    } else {
      existing.push(entry);
    }
    
    localStorage.setItem(STORAGE_KEY, JSON.stringify(existing));
    return true;
  } catch (error) {
    console.error('Failed to save mood:', error);
    return false;
  }
}

export function getMoods() {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : [];
  } catch (error) {
    console.error('Failed to load moods:', error);
    return [];
  }
}

export function updateMood(date, patch) {
  try {
    const moods = getMoods();
    const index = moods.findIndex(e => e.date === date);
    
    if (index >= 0) {
      moods[index] = { ...moods[index], ...patch };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(moods));
      return true;
    }
    return false;
  } catch (error) {
    console.error('Failed to update mood:', error);
    return false;
  }
}

export function getToday() {
  const today = new Date().toISOString().slice(0, 10);
  const moods = getMoods();
  return moods.find(e => e.date === today) || null;
}

export function deleteMood(date) {
  try {
    const moods = getMoods();
    const filtered = moods.filter(e => e.date !== date);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
    return true;
  } catch (error) {
    console.error('Failed to delete mood:', error);
    return false;
  }
} 