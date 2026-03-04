import { sanitizePersistedGameState, type PersistedGameState } from '../store/gameStore.ts';

export const LOCAL_STATE_KEY = 'handball-elo-local-state';
export const SNAPSHOTS_KEY = 'handball-elo-snapshots';
const MAX_SNAPSHOTS = 20;

export interface LocalStateEntry {
  state: PersistedGameState;
  updatedAt: string; // ISO string
  localRevision: number;
}

export interface SnapshotEntry {
  state: PersistedGameState;
  savedAt: string; // ISO string
  localRevision: number;
}

export function loadLocalState(): LocalStateEntry | null {
  try {
    const raw = localStorage.getItem(LOCAL_STATE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    if (!parsed.state) return null;
    return {
      state: sanitizePersistedGameState(parsed.state),
      updatedAt: typeof parsed.updatedAt === 'string' ? parsed.updatedAt : new Date(0).toISOString(),
      localRevision: typeof parsed.localRevision === 'number' ? parsed.localRevision : 0,
    };
  } catch {
    return null;
  }
}

export function saveLocalState(state: PersistedGameState, localRevision: number): LocalStateEntry {
  const entry: LocalStateEntry = {
    state,
    updatedAt: new Date().toISOString(),
    localRevision,
  };
  try {
    localStorage.setItem(LOCAL_STATE_KEY, JSON.stringify(entry));
    addSnapshot(entry);
  } catch {
    // Storage full or unavailable — ignore
  }
  return entry;
}

function addSnapshot(entry: LocalStateEntry): void {
  try {
    const raw = localStorage.getItem(SNAPSHOTS_KEY);
    const snapshots: SnapshotEntry[] = raw ? (JSON.parse(raw) as SnapshotEntry[]) : [];
    snapshots.push({
      state: entry.state,
      savedAt: entry.updatedAt,
      localRevision: entry.localRevision,
    });
    if (snapshots.length > MAX_SNAPSHOTS) {
      snapshots.splice(0, snapshots.length - MAX_SNAPSHOTS);
    }
    localStorage.setItem(SNAPSHOTS_KEY, JSON.stringify(snapshots));
  } catch {
    // Storage full — ignore
  }
}

export function loadSnapshots(): SnapshotEntry[] {
  try {
    const raw = localStorage.getItem(SNAPSHOTS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown[];
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((s): s is Record<string, unknown> => s !== null && typeof s === 'object')
      .map((s) => ({
        state: sanitizePersistedGameState(s.state),
        savedAt: typeof s.savedAt === 'string' ? s.savedAt : new Date(0).toISOString(),
        localRevision: typeof s.localRevision === 'number' ? s.localRevision : 0,
      }));
  } catch {
    return [];
  }
}
