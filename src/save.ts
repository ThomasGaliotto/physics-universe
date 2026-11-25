/** Progress is kept in the browser (per device). Every access is guarded: storage can be unavailable. */
export interface SaveData {
  stars: Record<string, [boolean, boolean, boolean]>;
  gems: number;
  seenIntro: Record<string, boolean>;
}

const KEY = 'physics-universe-save-v1';

export function loadSave(): SaveData {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const d = JSON.parse(raw) as Partial<SaveData>;
      return { stars: d.stars ?? {}, gems: d.gems ?? 0, seenIntro: d.seenIntro ?? {} };
    }
  } catch {
    // ignore: private mode or blocked storage
  }
  return { stars: {}, gems: 0, seenIntro: {} };
}

export function writeSave(d: SaveData) {
  try {
    localStorage.setItem(KEY, JSON.stringify(d));
  } catch {
    // ignore
  }
}

export function totalStars(d: SaveData) {
  return Object.values(d.stars).reduce((n, s) => n + s.filter(Boolean).length, 0);
}

export function playerLevel(d: SaveData) {
  return 1 + Math.floor(totalStars(d) / 3);
}
