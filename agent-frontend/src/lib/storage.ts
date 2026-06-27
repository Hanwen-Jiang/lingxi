// localStorage helpers that never throw. Access can fail in private-mode or
// when storage is disabled/blocked, so every read and write is guarded; a
// failure simply degrades to "no persistence" rather than crashing the app.

export const STORAGE_KEYS = {
  apiBase: "lingxi.apiBase",
  lastSessionId: "lingxi.lastSessionId",
} as const;

export function readStorage(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function writeStorage(key: string, value: string) {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Ignore: storage unavailable (private mode, quota, disabled).
  }
}

export function deleteStorage(key: string) {
  try {
    window.localStorage.removeItem(key);
  } catch {
    // Ignore: storage unavailable (private mode, quota, disabled).
  }
}
