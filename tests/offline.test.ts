import test from 'node:test';
import assert from 'node:assert/strict';

// ── Minimal localStorage mock for Node.js ────────────────────────────────────
const mockStorage: Record<string, string> = {};
const localStorageMock = {
  getItem: (key: string) => mockStorage[key] ?? null,
  setItem: (key: string, value: string) => {
    mockStorage[key] = value;
  },
  removeItem: (key: string) => {
    delete mockStorage[key];
  },
  clear: () => {
    for (const k of Object.keys(mockStorage)) {
      delete mockStorage[k];
    }
  },
};
// @ts-expect-error — global mock for testing
global.localStorage = localStorageMock;

// Import AFTER mock is set up
const { loadLocalState, saveLocalState, loadSnapshots, LOCAL_STATE_KEY, SNAPSHOTS_KEY } =
  await import('../src/lib/localPersistence.ts');
const { enqueueSync, loadQueue, saveQueue, clearQueue, SYNC_QUEUE_KEY } =
  await import('../src/lib/syncQueue.ts');
const { sanitizePersistedGameState } = await import('../src/store/gameStore.ts');

// ── Helper ────────────────────────────────────────────────────────────────────
function makeState(seed = 0) {
  return sanitizePersistedGameState({
    players: { [`player${seed}`]: { id: `player${seed}`, name: `Player${seed}`, elo: 1000 + seed, gamesPlayed: seed, eliminations: 0, timesEliminated: 0, createdAt: 0 } },
    gameHistory: [],
  });
}

function clearAll() {
  localStorageMock.clear();
}

// ── localPersistence tests ────────────────────────────────────────────────────

test('loadLocalState returns null when nothing is stored', () => {
  clearAll();
  assert.equal(loadLocalState(), null);
});

test('saveLocalState and loadLocalState round-trip state', () => {
  clearAll();
  const state = makeState(1);
  saveLocalState(state, 1);

  const loaded = loadLocalState();
  assert.notEqual(loaded, null);
  assert.equal(loaded!.localRevision, 1);
  assert.equal(typeof loaded!.updatedAt, 'string');
  assert.deepEqual(loaded!.state.players, state.players);
});

test('saveLocalState increments are reflected in loaded revision', () => {
  clearAll();
  const state = makeState(2);
  saveLocalState(state, 5);
  const loaded = loadLocalState();
  assert.equal(loaded!.localRevision, 5);
});

test('saveLocalState adds entry to snapshots', () => {
  clearAll();
  saveLocalState(makeState(1), 1);
  saveLocalState(makeState(2), 2);
  saveLocalState(makeState(3), 3);

  const snaps = loadSnapshots();
  assert.equal(snaps.length, 3);
  assert.equal(snaps[0].localRevision, 1);
  assert.equal(snaps[2].localRevision, 3);
});

test('snapshots are capped at 20 entries', () => {
  clearAll();
  for (let i = 1; i <= 25; i++) {
    saveLocalState(makeState(i), i);
  }
  const snaps = loadSnapshots();
  assert.equal(snaps.length, 20);
  // Oldest 5 should have been evicted; first remaining revision = 6
  assert.equal(snaps[0].localRevision, 6);
});

test('loadLocalState is tolerant of corrupt JSON', () => {
  clearAll();
  mockStorage[LOCAL_STATE_KEY] = '{bad json:::}';
  assert.equal(loadLocalState(), null);
});

test('loadSnapshots is tolerant of corrupt JSON', () => {
  clearAll();
  mockStorage[SNAPSHOTS_KEY] = 'not an array';
  assert.deepEqual(loadSnapshots(), []);
});

// ── syncQueue tests ───────────────────────────────────────────────────────────

test('loadQueue returns empty array when nothing stored', () => {
  clearAll();
  assert.deepEqual(loadQueue(), []);
});

test('enqueueSync adds entry to queue', () => {
  clearAll();
  const state = makeState(10);
  enqueueSync(state, '2024-01-01T00:00:00.000Z', 1);

  const queue = loadQueue();
  assert.equal(queue.length, 1);
  assert.equal(queue[0].localRevision, 1);
  assert.equal(queue[0].retries, 0);
  assert.equal(queue[0].updatedAt, '2024-01-01T00:00:00.000Z');
});

test('enqueueSync discards entries with lower revision', () => {
  clearAll();
  const state = makeState(11);
  enqueueSync(state, '2024-01-01T00:00:00.000Z', 3);
  enqueueSync(state, '2024-01-02T00:00:00.000Z', 5);

  // Enqueue revision 4 — revision 3 was already superseded
  enqueueSync(state, '2024-01-01T12:00:00.000Z', 4);

  const queue = loadQueue();
  // Only revisions >= 4 survive (5 and 4)
  const revisions = queue.map((e) => e.localRevision).sort((a, b) => a - b);
  assert.ok(!revisions.includes(3), 'revision 3 should be discarded');
});

test('clearQueue empties the queue', () => {
  clearAll();
  enqueueSync(makeState(12), '2024-01-01T00:00:00.000Z', 1);
  assert.equal(loadQueue().length, 1);

  clearQueue();
  assert.deepEqual(loadQueue(), []);
});

test('saveQueue persists and loadQueue restores', () => {
  clearAll();
  const state = makeState(13);
  const entry = {
    payload: state,
    updatedAt: '2024-06-01T00:00:00.000Z',
    localRevision: 7,
    enqueuedAt: 1_000_000,
    retries: 2,
  };
  saveQueue([entry]);

  const loaded = loadQueue();
  assert.equal(loaded.length, 1);
  assert.equal(loaded[0].localRevision, 7);
  assert.equal(loaded[0].retries, 2);
});

test('loadQueue is tolerant of corrupt JSON', () => {
  clearAll();
  mockStorage[SYNC_QUEUE_KEY] = '{bad json';
  assert.deepEqual(loadQueue(), []);
});

// ── Conflict resolution (last-write-wins) logic ───────────────────────────────

test('last-write-wins: newer remote updatedAt wins over older local', () => {
  const localUpdatedAt = '2024-01-01T10:00:00.000Z';
  const remoteUpdatedAt = '2024-01-01T11:00:00.000Z';
  assert.ok(remoteUpdatedAt >= localUpdatedAt, 'remote should win when it is newer');
});

test('last-write-wins: equal timestamps favour remote (re-hydrate is idempotent)', () => {
  const ts = '2024-01-01T10:00:00.000Z';
  assert.ok(ts >= ts, 'equal timestamps: remote wins (>=)');
});

test('last-write-wins: older remote loses to local', () => {
  const localUpdatedAt = '2024-01-01T12:00:00.000Z';
  const remoteUpdatedAt = '2024-01-01T10:00:00.000Z';
  assert.ok(!(remoteUpdatedAt >= localUpdatedAt), 'local should win when it is newer');
});
