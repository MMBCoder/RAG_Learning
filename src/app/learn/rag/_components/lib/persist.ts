/* Versioned localStorage helper (M0 foundation).
   Persists ONLY small preference/accounting data — never document artifacts:
   the user's PDF content stays in memory and leaves no trace on disk. */

const PREFIX = "rag-viz:";

interface Envelope<T> { v: number; data: T; }

function storage(): Storage | null {
  try {
    if (typeof window === "undefined") return null;
    return window.localStorage;
  } catch {
    return null;   // privacy mode / storage disabled
  }
}

export function loadPersisted<T>(key: string, version: number, fallback: T): T {
  const store = storage();
  if (!store) return fallback;
  try {
    const raw = store.getItem(PREFIX + key);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as Envelope<T>;
    if (parsed?.v !== version) return fallback;   // schema changed → discard
    return parsed.data;
  } catch {
    return fallback;
  }
}

export function savePersisted<T>(key: string, version: number, data: T): void {
  const store = storage();
  if (!store) return;
  try {
    store.setItem(PREFIX + key, JSON.stringify({ v: version, data } satisfies Envelope<T>));
  } catch {
    // quota exceeded / disabled — persistence is best-effort by design
  }
}

export function clearPersisted(key: string): void {
  const store = storage();
  if (!store) return;
  try {
    store.removeItem(PREFIX + key);
  } catch { /* ignore */ }
}
