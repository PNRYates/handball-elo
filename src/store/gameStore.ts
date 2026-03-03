import { create } from 'zustand';
import type { Player, Turn, CourtPosition, GameSnapshot, CompletedGame } from '../types';
import { processTurn } from '../lib/gameEngine.ts';

const MAX_TURN_STACK = 100;
const MAX_RECENT_ENTRANTS = 10;

export interface TurnStateSnapshot {
  players: Record<string, Player>;
  court: [string, string, string, string];
  turns: Turn[];
  turnNumber: number;
  _lastSnapshot: GameSnapshot | null;
  recentEntrants: string[];
}

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
  theme: 'dark' | 'light';
  requireKiller: boolean;
  showBigTurnButtons: boolean;
  showReserveButtons: boolean;
  undoStack: TurnStateSnapshot[];
  redoStack: TurnStateSnapshot[];
  recentEntrants: string[];
}

interface GameStore extends PersistedGameState {
  initializeGame: (names: [string, string, string, string]) => void;
  recordTurn: (
    eliminatedPos: CourtPosition,
    killerPos: CourtPosition,
    newPlayerName?: string
  ) => void;
  undoLastTurn: () => void;
  redoLastTurn: () => void;
  endGame: () => void;
  resetAllData: () => void;
  deleteGameFromHistory: (gameId: number) => void;
  renameGameInHistory: (gameId: number, name: string) => void;
  renamePlayer: (oldId: string, newName: string) => void;
  hydrateFromRemote: (state: PersistedGameState) => void;
  setTheme: (theme: 'dark' | 'light') => void;
  setRequireKiller: (requireKiller: boolean) => void;
  setShowBigTurnButtons: (showBigTurnButtons: boolean) => void;
  setShowReserveButtons: (showReserveButtons: boolean) => void;
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
    theme: 'dark',
    requireKiller: true,
    showBigTurnButtons: false,
    showReserveButtons: true,
    undoStack: [],
    redoStack: [],
    recentEntrants: [],
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
    theme: state.theme,
    requireKiller: state.requireKiller,
    showBigTurnButtons: state.showBigTurnButtons,
    showReserveButtons: state.showReserveButtons,
    undoStack: state.undoStack,
    redoStack: state.redoStack,
    recentEntrants: state.recentEntrants,
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
    ? (input.gameHistory as CompletedGame[]).map((game) => ({
        ...game,
        name:
          typeof game.name === 'string'
            ? game.name
            : game.name === null
              ? null
              : null,
      }))
    : fallback.gameHistory;
  const lastSnapshot = isRecord(input._lastSnapshot)
    ? (input._lastSnapshot as unknown as GameSnapshot)
    : null;
  const isInitialized = typeof input.isInitialized === 'boolean' ? input.isInitialized : fallback.isInitialized;
  const theme = input.theme === 'light' ? 'light' : 'dark';
  const requireKiller =
    typeof input.requireKiller === 'boolean' ? input.requireKiller : fallback.requireKiller;
  const showBigTurnButtons =
    typeof input.showBigTurnButtons === 'boolean'
      ? input.showBigTurnButtons
      : fallback.showBigTurnButtons;
  const showReserveButtons =
    typeof input.showReserveButtons === 'boolean'
      ? input.showReserveButtons
      : fallback.showReserveButtons;
  const undoStack = Array.isArray(input.undoStack)
    ? (input.undoStack as TurnStateSnapshot[])
    : fallback.undoStack;
  const redoStack = Array.isArray(input.redoStack)
    ? (input.redoStack as TurnStateSnapshot[])
    : fallback.redoStack;
  const recentEntrants = Array.isArray(input.recentEntrants)
    ? (input.recentEntrants as string[])
    : fallback.recentEntrants;

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
    theme,
    requireKiller,
    showBigTurnButtons,
    showReserveButtons,
    undoStack,
    redoStack,
    recentEntrants,
  };
}

function createTurnStateSnapshot(state: PersistedGameState): TurnStateSnapshot {
  return {
    players: JSON.parse(JSON.stringify(state.players)),
    court: [...state.court] as [string, string, string, string],
    turns: JSON.parse(JSON.stringify(state.turns)),
    turnNumber: state.turnNumber,
    _lastSnapshot: state._lastSnapshot
      ? {
          players: JSON.parse(JSON.stringify(state._lastSnapshot.players)),
          court: [...state._lastSnapshot.court] as [string, string, string, string],
          turnNumber: state._lastSnapshot.turnNumber,
        }
      : null,
    recentEntrants: [...state.recentEntrants],
  };
}

export const useGameStore = create<GameStore>((set, get) => ({
  ...createInitialState(),

  hydrateFromRemote: (state) => {
    set(sanitizePersistedGameState(state));
  },

  setTheme: (theme) => set({ theme }),

  setRequireKiller: (requireKiller) => set({ requireKiller }),

  setShowBigTurnButtons: (showBigTurnButtons) => set({ showBigTurnButtons }),

  setShowReserveButtons: (showReserveButtons) => set({ showReserveButtons }),

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
      undoStack: [],
      redoStack: [],
    });
  },

  recordTurn: (eliminatedPos, killerPos, newPlayerName) => {
    const state = get();

    const snapshot: GameSnapshot = {
      players: JSON.parse(JSON.stringify(state.players)),
      court: [...state.court] as [string, string, string, string],
      turnNumber: state.turnNumber,
    };
    const turnStateSnapshot = createTurnStateSnapshot(state);

    const result = processTurn(
      state.court,
      state.players,
      eliminatedPos,
      killerPos,
      newPlayerName,
      state.requireKiller
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

    const updatedRecentEntrants = result.newPlayer
      ? [
          result.newPlayer.id,
          ...state.recentEntrants.filter((id) => id !== result.newPlayer?.id),
        ].slice(0, MAX_RECENT_ENTRANTS)
      : state.recentEntrants;

    set({
      court: result.newCourt,
      players: result.updatedPlayers,
      turns: [...state.turns, turn],
      turnNumber: state.turnNumber + 1,
      _lastSnapshot: snapshot,
      undoStack: [...state.undoStack, turnStateSnapshot].slice(-MAX_TURN_STACK),
      redoStack: [],
      recentEntrants: updatedRecentEntrants,
    });
  },

  undoLastTurn: () => {
    const state = get();
    if (state.undoStack.length === 0) return;

    const previous = state.undoStack[state.undoStack.length - 1];
    const currentSnapshot = createTurnStateSnapshot(state);

    set({
      players: previous.players,
      court: previous.court,
      turns: previous.turns,
      turnNumber: previous.turnNumber,
      _lastSnapshot: previous._lastSnapshot,
      recentEntrants: previous.recentEntrants,
      undoStack: state.undoStack.slice(0, -1),
      redoStack: [...state.redoStack, currentSnapshot].slice(-MAX_TURN_STACK),
    });
  },

  redoLastTurn: () => {
    const state = get();
    if (state.redoStack.length === 0) return;

    const next = state.redoStack[state.redoStack.length - 1];
    const currentSnapshot = createTurnStateSnapshot(state);

    set({
      players: next.players,
      court: next.court,
      turns: next.turns,
      turnNumber: next.turnNumber,
      _lastSnapshot: next._lastSnapshot,
      recentEntrants: next.recentEntrants,
      redoStack: state.redoStack.slice(0, -1),
      undoStack: [...state.undoStack, currentSnapshot].slice(-MAX_TURN_STACK),
    });
  },

  endGame: () => {
    const state = get();
    if (!state.gameInProgress || state.turns.length === 0) return;

    const nextGameId = state.gameHistory.reduce((maxId, game) => Math.max(maxId, game.id), 0) + 1;
    const completedGame: CompletedGame = {
      id: nextGameId,
      name: null,
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
      undoStack: [],
      redoStack: [],
      // players and isInitialized stay — ELOs persist
    });
  },

  resetAllData: () => {
    set(createInitialState());
  },

  deleteGameFromHistory: (gameId) => {
    const state = get();
    set({
      gameHistory: state.gameHistory.filter((game) => game.id !== gameId),
    });
  },

  renameGameInHistory: (gameId, name) => {
    const state = get();
    const trimmed = name.trim();
    set({
      gameHistory: state.gameHistory.map((game) =>
        game.id === gameId ? { ...game, name: trimmed.length > 0 ? trimmed : null } : game
      ),
    });
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

    const mapTurnStateSnapshot = (snap: TurnStateSnapshot): TurnStateSnapshot => ({
      ...snap,
      players: Object.fromEntries(
        Object.entries(snap.players).map(([k, v]) =>
          k === oldId
            ? [newId, { ...v, id: newId, name: trimmedName }]
            : [k, v]
        )
      ),
      court: mapCourt(snap.court),
      turns: snap.turns.map((turn) => ({
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
      _lastSnapshot: snap._lastSnapshot
        ? {
            ...snap._lastSnapshot,
            players: Object.fromEntries(
              Object.entries(snap._lastSnapshot.players).map(([k, v]) =>
                k === oldId
                  ? [newId, { ...v, id: newId, name: trimmedName }]
                  : [k, v]
              )
            ),
            court: mapCourt(snap._lastSnapshot.court),
          }
        : null,
      recentEntrants: snap.recentEntrants.map(mapId),
    });

    set({
      players: updatedPlayers,
      court: newCourt,
      turns: newTurns,
      gameHistory: newGameHistory,
      _lastSnapshot: newSnapshot,
      undoStack: state.undoStack.map(mapTurnStateSnapshot),
      redoStack: state.redoStack.map(mapTurnStateSnapshot),
      recentEntrants: state.recentEntrants.map(mapId),
    });
  },
}));
