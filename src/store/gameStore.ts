import { create } from 'zustand';
import type { Player, Turn, CourtPosition, GameSnapshot, CompletedGame } from '../types';
import { processTurn } from '../lib/gameEngine';

export interface PersistedGameState {
  players: Record<string, Player>;
  court: [string, string, string, string];
  turns: Turn[];
  turnNumber: number;
  gameInProgress: boolean;
  gameStartedAt: number | null;
  gameHistory: CompletedGame[];
  _lastSnapshot: GameSnapshot | null;
  isInitialized: boolean;
}

interface GameStore extends PersistedGameState {
  initializeGame: (names: [string, string, string, string]) => void;
  recordTurn: (
    eliminatedPos: CourtPosition,
    killerPos: CourtPosition,
    newPlayerName?: string
  ) => void;
  undoLastTurn: () => void;
  endGame: () => void;
  resetAllData: () => void;
  renamePlayer: (oldId: string, newName: string) => void;
  hydrateFromRemote: (state: PersistedGameState) => void;
}

function createInitialState(): PersistedGameState {
  return {
    players: {},
    court: ['', '', '', ''],
    turns: [],
    turnNumber: 0,
    gameInProgress: false,
    gameStartedAt: null,
    gameHistory: [],
    _lastSnapshot: null,
    isInitialized: false,
  };
}

export function getPersistedGameState(state: PersistedGameState): PersistedGameState {
  return {
    players: state.players,
    court: state.court,
    turns: state.turns,
    turnNumber: state.turnNumber,
    gameInProgress: state.gameInProgress,
    gameStartedAt: state.gameStartedAt,
    gameHistory: state.gameHistory,
    _lastSnapshot: state._lastSnapshot,
    isInitialized: state.isInitialized,
  };
}

function isCourt(value: unknown): value is [string, string, string, string] {
  return Array.isArray(value) && value.length === 4 && value.every((v) => typeof v === 'string');
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object';
}

export function sanitizePersistedGameState(input: unknown): PersistedGameState {
  const fallback = createInitialState();
  if (!isRecord(input)) return fallback;

  const players = isRecord(input.players) ? (input.players as Record<string, Player>) : fallback.players;
  const court = isCourt(input.court) ? input.court : fallback.court;
  const turns = Array.isArray(input.turns) ? (input.turns as Turn[]) : fallback.turns;
  const turnNumber = typeof input.turnNumber === 'number' ? input.turnNumber : fallback.turnNumber;
  const gameInProgress = typeof input.gameInProgress === 'boolean' ? input.gameInProgress : fallback.gameInProgress;
  const gameStartedAt =
    typeof input.gameStartedAt === 'number' || input.gameStartedAt === null
      ? input.gameStartedAt
      : fallback.gameStartedAt;
  const gameHistory = Array.isArray(input.gameHistory)
    ? (input.gameHistory as CompletedGame[])
    : fallback.gameHistory;
  const lastSnapshot = isRecord(input._lastSnapshot)
    ? (input._lastSnapshot as unknown as GameSnapshot)
    : null;
  const isInitialized = typeof input.isInitialized === 'boolean' ? input.isInitialized : fallback.isInitialized;

  return {
    players,
    court,
    turns,
    turnNumber,
    gameInProgress,
    gameStartedAt,
    gameHistory,
    _lastSnapshot: lastSnapshot,
    isInitialized,
  };
}

export const useGameStore = create<GameStore>((set, get) => ({
  ...createInitialState(),

  hydrateFromRemote: (state) => {
    set(sanitizePersistedGameState(state));
  },

  initializeGame: (names) => {
    const state = get();
    const players: Record<string, Player> = { ...state.players };
    const court: [string, string, string, string] = ['', '', '', ''];

    for (let i = 0; i < 4; i++) {
      const trimmed = names[i].trim();
      const id = trimmed.toLowerCase();
      if (!players[id]) {
        players[id] = {
          id,
          name: trimmed,
          elo: 1000,
          gamesPlayed: 0,
          eliminations: 0,
          timesEliminated: 0,
          createdAt: Date.now(),
        };
      }
      court[i] = id;
    }

    set({
      players,
      court,
      turns: [],
      turnNumber: 0,
      gameInProgress: true,
      gameStartedAt: Date.now(),
      isInitialized: true,
      _lastSnapshot: null,
    });
  },

  recordTurn: (eliminatedPos, killerPos, newPlayerName) => {
    const state = get();

    const snapshot: GameSnapshot = {
      players: JSON.parse(JSON.stringify(state.players)),
      court: [...state.court] as [string, string, string, string],
      turnNumber: state.turnNumber,
    };

    const result = processTurn(
      state.court,
      state.players,
      eliminatedPos,
      killerPos,
      newPlayerName
    );

    const turn: Turn = {
      turnNumber: state.turnNumber,
      timestamp: Date.now(),
      courtBefore: [...state.court] as [string, string, string, string],
      eliminatedPlayerId: state.court[eliminatedPos],
      eliminatedPosition: eliminatedPos,
      killerPlayerId: state.court[killerPos],
      killerPosition: killerPos,
      newPlayerId: result.newPlayer?.id ?? null,
      courtAfter: [...result.newCourt] as [string, string, string, string],
      eloChanges: result.eloChanges,
    };

    set({
      court: result.newCourt,
      players: result.updatedPlayers,
      turns: [...state.turns, turn],
      turnNumber: state.turnNumber + 1,
      _lastSnapshot: snapshot,
    });
  },

  undoLastTurn: () => {
    const state = get();
    if (state.turns.length === 0 || !state._lastSnapshot) return;

    set({
      court: state._lastSnapshot.court,
      players: state._lastSnapshot.players,
      turns: state.turns.slice(0, -1),
      turnNumber: state._lastSnapshot.turnNumber,
      _lastSnapshot: null,
    });
  },

  endGame: () => {
    const state = get();
    if (!state.gameInProgress || state.turns.length === 0) return;

    const completedGame: CompletedGame = {
      id: state.gameHistory.length + 1,
      startedAt: state.gameStartedAt ?? state.turns[0].timestamp,
      endedAt: Date.now(),
      turns: [...state.turns],
      startingCourt: state.turns[0].courtBefore,
      finalCourt: [...state.court] as [string, string, string, string],
    };

    set({
      gameHistory: [...state.gameHistory, completedGame],
      court: ['', '', '', ''],
      turns: [],
      turnNumber: 0,
      gameInProgress: false,
      gameStartedAt: null,
      _lastSnapshot: null,
      // players and isInitialized stay — ELOs persist
    });
  },

  resetAllData: () => {
    set(createInitialState());
  },

  renamePlayer: (oldId, newName) => {
    const state = get();
    const trimmedName = newName.trim();
    if (!trimmedName || !state.players[oldId]) return;

    const newId = trimmedName.toLowerCase();

    // Same ID — just update display name
    if (newId === oldId) {
      const updatedPlayers = { ...state.players };
      updatedPlayers[oldId] = { ...updatedPlayers[oldId], name: trimmedName };
      set({ players: updatedPlayers });
      return;
    }

    // Different ID — reject if target already exists
    if (state.players[newId]) return;

    const updatedPlayers = { ...state.players };
    const player = { ...updatedPlayers[oldId], id: newId, name: trimmedName };
    delete updatedPlayers[oldId];
    updatedPlayers[newId] = player;

    const mapId = (id: string) => (id === oldId ? newId : id);
    const mapCourt = (c: [string, string, string, string]) =>
      c.map(mapId) as [string, string, string, string];

    const newCourt = state.gameInProgress ? mapCourt(state.court) : state.court;

    const newTurns = state.turns.map((turn) => ({
      ...turn,
      eliminatedPlayerId: mapId(turn.eliminatedPlayerId),
      killerPlayerId: mapId(turn.killerPlayerId),
      newPlayerId: turn.newPlayerId ? mapId(turn.newPlayerId) : null,
      courtBefore: mapCourt(turn.courtBefore),
      courtAfter: mapCourt(turn.courtAfter),
      eloChanges: turn.eloChanges.map((c) => ({
        ...c,
        playerId: mapId(c.playerId),
      })),
    }));

    const newGameHistory = state.gameHistory.map((game) => ({
      ...game,
      startingCourt: mapCourt(game.startingCourt),
      finalCourt: mapCourt(game.finalCourt),
      turns: game.turns.map((turn) => ({
        ...turn,
        eliminatedPlayerId: mapId(turn.eliminatedPlayerId),
        killerPlayerId: mapId(turn.killerPlayerId),
        newPlayerId: turn.newPlayerId ? mapId(turn.newPlayerId) : null,
        courtBefore: mapCourt(turn.courtBefore),
        courtAfter: mapCourt(turn.courtAfter),
        eloChanges: turn.eloChanges.map((c) => ({
          ...c,
          playerId: mapId(c.playerId),
        })),
      })),
    }));

    const newSnapshot = state._lastSnapshot
      ? {
          ...state._lastSnapshot,
          players: Object.fromEntries(
            Object.entries(state._lastSnapshot.players).map(([k, v]) =>
              k === oldId
                ? [newId, { ...v, id: newId, name: trimmedName }]
                : [k, v]
            )
          ),
          court: mapCourt(state._lastSnapshot.court),
        }
      : null;

    set({
      players: updatedPlayers,
      court: newCourt,
      turns: newTurns,
      gameHistory: newGameHistory,
      _lastSnapshot: newSnapshot,
    });
  },
}));
