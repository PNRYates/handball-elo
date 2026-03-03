import type { CompletedGame, CourtPosition, Player, Turn } from '../types';
import type { PersistedGameState } from '../store/gameStore';
import { processTurn } from './gameEngine.ts';

const SAMPLE_NAMES = [
  'Alice',
  'Bob',
  'Cara',
  'Dan',
  'Eve',
  'Frank',
  'Grace',
  'Henry',
  'Ivy',
  'Jack',
  'Kira',
  'Liam',
];

function createPlayer(name: string, createdAt: number): Player {
  const id = name.toLowerCase();
  return {
    id,
    name,
    elo: 1000,
    gamesPlayed: 0,
    eliminations: 0,
    timesEliminated: 0,
    createdAt,
  };
}

function seedRandom(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0xffffffff;
  };
}

function weightedPosition(rand: () => number): CourtPosition {
  const roll = rand();
  if (roll < 0.22) return 0;
  if (roll < 0.48) return 1;
  if (roll < 0.74) return 2;
  return 3;
}

function pickIndex(rand: () => number, count: number): number {
  return Math.floor(rand() * count) % count;
}

export function buildSampleState(): PersistedGameState {
  const now = Date.now();
  const rand = seedRandom(42);
  const players: Record<string, Player> = {};
  const gameHistory: CompletedGame[] = [];

  const ensurePlayer = (name: string): Player => {
    const id = name.toLowerCase();
    if (!players[id]) {
      players[id] = createPlayer(name, now - Math.floor(rand() * 8_000_000));
    }
    return players[id];
  };

  const totalGames = 8;
  for (let gameIdx = 0; gameIdx < totalGames; gameIdx++) {
    const startedAt = now - (totalGames - gameIdx) * 3_600_000;
    const lineup = SAMPLE_NAMES.slice(gameIdx, gameIdx + 4).map((_, i) => SAMPLE_NAMES[(gameIdx + i) % SAMPLE_NAMES.length]);
    let court = lineup.map((name) => ensurePlayer(name).id) as [string, string, string, string];
    const startingCourt = [...court] as [string, string, string, string];
    const turns: Turn[] = [];

    const turnCount = 20 + pickIndex(rand, 20);
    for (let turnNumber = 0; turnNumber < turnCount; turnNumber++) {
      const eliminatedPos = weightedPosition(rand);
      const alivePositions = [0, 1, 2, 3].filter((p) => p !== eliminatedPos);
      const killerPos = alivePositions[pickIndex(rand, alivePositions.length)] as CourtPosition;

      let entrantName: string | undefined;
      if (eliminatedPos !== 0) {
        const offCourtNames = SAMPLE_NAMES.filter((name) => !court.includes(name.toLowerCase()));
        entrantName = offCourtNames[pickIndex(rand, offCourtNames.length)];
        ensurePlayer(entrantName);
      }

      const before = [...court] as [string, string, string, string];
      const result = processTurn(court, players, eliminatedPos, killerPos, entrantName, true);
      const timestamp = startedAt + turnNumber * 45_000;

      turns.push({
        turnNumber,
        timestamp,
        courtBefore: before,
        eliminatedPlayerId: before[eliminatedPos],
        eliminatedPosition: eliminatedPos,
        killerPlayerId: before[killerPos],
        killerPosition: killerPos,
        newPlayerId: result.newPlayer?.id ?? null,
        courtAfter: [...result.newCourt] as [string, string, string, string],
        eloChanges: result.eloChanges,
      });

      court = [...result.newCourt] as [string, string, string, string];
      Object.assign(players, result.updatedPlayers);
    }

    const endedAt = startedAt + turnCount * 45_000;
    gameHistory.push({
      id: gameIdx + 1,
      name: `Sample Game ${gameIdx + 1}`,
      startedAt,
      endedAt,
      turns,
      startingCourt,
      finalCourt: court,
    });
  }

  return {
    players,
    court: ['', '', '', ''],
    turns: [],
    turnNumber: 0,
    gameInProgress: false,
    gameStartedAt: null,
    gameHistory,
    _lastSnapshot: null,
    isInitialized: true,
    theme: 'dark',
    requireKiller: true,
    showBigTurnButtons: false,
    showReserveButtons: true,
    undoStack: [],
    redoStack: [],
    recentEntrants: [],
  };
}
