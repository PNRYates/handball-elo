import type { PersistedGameState } from '../store/gameStore.ts';

export const SYNC_QUEUE_KEY = 'handball-elo-sync-queue';

export interface SyncQueueEntry {
  payload: PersistedGameState;
  updatedAt: string; // ISO string
  localRevision: number;
  enqueuedAt: number; // ms timestamp
  retries: number;
}

/** Add (or replace) an entry in the outbound sync queue. Older revisions are discarded. */
export function enqueueSync(
  payload: PersistedGameState,
  updatedAt: string,
  localRevision: number,
): void {
  const queue = loadQueue();
  // Keep only entries with a strictly higher revision (shouldn't happen but defensive)
  const filtered = queue.filter((e) => e.localRevision > localRevision);
  filtered.push({
    payload,
    updatedAt,
    localRevision,
    enqueuedAt: Date.now(),
    retries: 0,
  });
  saveQueue(filtered);
}

export function loadQueue(): SyncQueueEntry[] {
  try {
    const raw = localStorage.getItem(SYNC_QUEUE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as SyncQueueEntry[]) : [];
  } catch {
    return [];
  }
}

export function saveQueue(queue: SyncQueueEntry[]): void {
  try {
    localStorage.setItem(SYNC_QUEUE_KEY, JSON.stringify(queue));
  } catch {
    // Storage full — ignore
  }
}

export function clearQueue(): void {
  try {
    localStorage.removeItem(SYNC_QUEUE_KEY);
  } catch {
    // ignore
  }
}
