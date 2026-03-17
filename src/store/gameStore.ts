import { create } from 'zustand';
import type { AnalyticsFilterState, AnalyticsScope } from '../types/analytics';
import type { CompletedGame, CourtPosition, GameSnapshot, Player, Turn } from '../types';
import { processTurn } from '../lib/gameEngine.ts';
import { roundToInternal } from '../lib/rating.ts';

const MAX_TURN_STACK = 100;
const MAX_RECENT_ENTRANTS = 10;
const STATE_VERSION = 2;
const DEFAULT_WORKSPACE_ID = 'default';
const DEFAULT_WORKSPACE_NAME = 'Default Workspace';

const DEFAULT_ANALYTICS_FILTER: AnalyticsFilterState = {
  scope: 'all_time',
  includeCurrentGame: true,
  minTurnsThreshold: 5,
  rangeStartGameId: null,
  rangeEndGameId: null,
  dateStart: null,
  dateEnd: null,
};

export interface TurnStateSnapshot {
  players: Record<string, Player>;
  court: [string, string, string, string];
  turns: Turn[];
  turnNumber: number;
  _lastSnapshot: GameSnapshot | null;
  recentEntrants: string[];
  reserveLine: string[];
  reserveHoldPlayerIds: string[];
}

export interface WorkspaceAnalyticsState {
  filter: AnalyticsFilterState;
  selectedPlayers: string[];
  selectedPlayersUseDefault: boolean;
  h2hSort: 'volume' | 'net' | 'ratio';
  h2hPlayers: string[];
  trendWindow: 'all' | '50' | '20';
  tableRowsVisible: number;
  h2hRowsVisible: number;
}

export interface WorkspaceState {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
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
  showReserveButtons: boolean;
  trackReserveLine: boolean;
  reserveLine: string[];
  reserveHoldPlayerIds: string[];
  undoStack: TurnStateSnapshot[];
  redoStack: TurnStateSnapshot[];
  recentEntrants: string[];
  hiddenPlayerIds: string[];
  analytics: WorkspaceAnalyticsState;
}

export interface PersistedGameState {
  version: number;
  activeWorkspaceId: string;
  workspaces: Record<string, WorkspaceState>;
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
  hidePlayer: (playerId: string) => void;
  hydrateFromRemote: (state: PersistedGameState) => void;
  setTheme: (theme: 'dark' | 'light') => void;
  setRequireKiller: (requireKiller: boolean) => void;
  setShowReserveButtons: (showReserveButtons: boolean) => void;
  setTrackReserveLine: (trackReserveLine: boolean) => void;
  addToReserveLine: (name: string, index?: number) => void;
  moveReserveLinePlayer: (fromIndex: number, toIndex: number) => void;
  removeFromReserveLine: (playerId: string, holdTop: boolean) => void;
  clearReserveHold: (playerId?: string) => void;
  setAnalyticsFilter: (next: AnalyticsFilterState) => void;
  setSelectedPlayers: (next: string[]) => void;
  setH2hSort: (next: 'volume' | 'net' | 'ratio') => void;
  setH2hPlayers: (next: string[]) => void;
  setTrendWindow: (next: 'all' | '50' | '20') => void;
  setTableRowsVisible: (next: number) => void;
  setH2hRowsVisible: (next: number) => void;
  createWorkspace: (name?: string) => string;
  renameWorkspace: (workspaceId: string, name: string) => void;
  deleteWorkspace: (workspaceId: string) => void;
  switchWorkspace: (workspaceId: string) => void;
}

function isCourt(value: unknown): value is [string, string, string, string] {
  return Array.isArray(value) && value.length === 4 && value.every((v) => typeof v === 'string');
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object';
}

function toFiniteNumber(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function toNonNegativeInt(value: unknown, fallback: number): number {
  return Math.max(0, Math.trunc(toFiniteNumber(value, fallback)));
}

function toPosition(value: unknown, fallback: CourtPosition): CourtPosition {
  return value === 0 || value === 1 || value === 2 || value === 3 ? value : fallback;
}

function createDefaultAnalyticsState(): WorkspaceAnalyticsState {
  return {
    filter: { ...DEFAULT_ANALYTICS_FILTER },
    selectedPlayers: [],
    selectedPlayersUseDefault: true,
    h2hSort: 'volume',
    h2hPlayers: [],
    trendWindow: 'all',
    tableRowsVisible: 12,
    h2hRowsVisible: 20,
  };
}

function createWorkspaceState(id: string, name: string, now = Date.now()): WorkspaceState {
  return {
    id,
    name,
    createdAt: now,
    updatedAt: now,
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
    showReserveButtons: true,
    trackReserveLine: false,
    reserveLine: [],
    reserveHoldPlayerIds: [],
    undoStack: [],
    redoStack: [],
    recentEntrants: [],
    hiddenPlayerIds: [],
    analytics: createDefaultAnalyticsState(),
  };
}

function createInitialState(): PersistedGameState {
  const workspace = createWorkspaceState(DEFAULT_WORKSPACE_ID, DEFAULT_WORKSPACE_NAME);
  return {
    version: STATE_VERSION,
    activeWorkspaceId: workspace.id,
    workspaces: {
      [workspace.id]: workspace,
    },
  };
}

function sanitizeAnalyticsFilter(input: unknown): AnalyticsFilterState {
  if (!isRecord(input)) return { ...DEFAULT_ANALYTICS_FILTER };

  const scope =
    input.scope === 'all_time' ||
    input.scope === 'current_game' ||
    input.scope === 'last_5_games' ||
    input.scope === 'last_10_games' ||
    input.scope === 'game_range'
      ? (input.scope as AnalyticsScope)
      : DEFAULT_ANALYTICS_FILTER.scope;

  return {
    scope,
    includeCurrentGame:
      typeof input.includeCurrentGame === 'boolean'
        ? input.includeCurrentGame
        : DEFAULT_ANALYTICS_FILTER.includeCurrentGame,
    minTurnsThreshold:
      typeof input.minTurnsThreshold === 'number' && Number.isFinite(input.minTurnsThreshold)
        ? Math.max(1, Math.floor(input.minTurnsThreshold))
        : DEFAULT_ANALYTICS_FILTER.minTurnsThreshold,
    rangeStartGameId:
      typeof input.rangeStartGameId === 'number' || input.rangeStartGameId === null
        ? input.rangeStartGameId
        : DEFAULT_ANALYTICS_FILTER.rangeStartGameId,
    rangeEndGameId:
      typeof input.rangeEndGameId === 'number' || input.rangeEndGameId === null
        ? input.rangeEndGameId
        : DEFAULT_ANALYTICS_FILTER.rangeEndGameId,
    dateStart:
      typeof input.dateStart === 'string' || input.dateStart === null
        ? input.dateStart
        : DEFAULT_ANALYTICS_FILTER.dateStart,
    dateEnd:
      typeof input.dateEnd === 'string' || input.dateEnd === null
        ? input.dateEnd
        : DEFAULT_ANALYTICS_FILTER.dateEnd,
  };
}

function sanitizeAnalyticsState(input: unknown): WorkspaceAnalyticsState {
  const fallback = createDefaultAnalyticsState();
  if (!isRecord(input)) return fallback;

  return {
    filter: sanitizeAnalyticsFilter(input.filter),
    selectedPlayers: Array.isArray(input.selectedPlayers)
      ? input.selectedPlayers.filter((id): id is string => typeof id === 'string')
      : fallback.selectedPlayers,
    selectedPlayersUseDefault:
      typeof input.selectedPlayersUseDefault === 'boolean'
        ? input.selectedPlayersUseDefault
        : fallback.selectedPlayersUseDefault,
    h2hSort:
      input.h2hSort === 'net' || input.h2hSort === 'ratio' || input.h2hSort === 'volume'
        ? input.h2hSort
        : fallback.h2hSort,
    h2hPlayers: Array.isArray(input.h2hPlayers)
      ? input.h2hPlayers.filter((id): id is string => typeof id === 'string')
      : fallback.h2hPlayers,
    trendWindow:
      input.trendWindow === '50' || input.trendWindow === '20' || input.trendWindow === 'all'
        ? input.trendWindow
        : fallback.trendWindow,
    tableRowsVisible:
      typeof input.tableRowsVisible === 'number' && Number.isFinite(input.tableRowsVisible)
        ? Math.max(1, Math.floor(input.tableRowsVisible))
        : fallback.tableRowsVisible,
    h2hRowsVisible:
      typeof input.h2hRowsVisible === 'number' && Number.isFinite(input.h2hRowsVisible)
        ? Math.max(1, Math.floor(input.h2hRowsVisible))
        : fallback.h2hRowsVisible,
  };
}

function normalizePlayersMap(input: unknown): Record<string, Player> {
  if (!isRecord(input)) return {};

  const now = Date.now();
  const players: Record<string, Player> = {};
  for (const [key, value] of Object.entries(input)) {
    if (!isRecord(value)) continue;
    const id = typeof value.id === 'string' && value.id.trim().length > 0 ? value.id : key;
    const name = typeof value.name === 'string' && value.name.trim().length > 0 ? value.name : id;
    players[id] = {
      id,
      name,
      elo: roundToInternal(toFiniteNumber(value.elo, 1000)),
      gamesPlayed: toNonNegativeInt(value.gamesPlayed, 0),
      eliminations: toNonNegativeInt(value.eliminations, 0),
      timesEliminated: toNonNegativeInt(value.timesEliminated, 0),
      createdAt: toFiniteNumber(value.createdAt, now),
    };
  }

  return players;
}

function normalizeEloChange(input: unknown): Turn['eloChanges'][number] | null {
  if (!isRecord(input)) return null;
  const reason =
    input.reason === 'elimination_kill' ||
    input.reason === 'elimination_death' ||
    input.reason === 'survival'
      ? input.reason
      : null;
  if (!reason || typeof input.playerId !== 'string') return null;

  const previousElo = roundToInternal(toFiniteNumber(input.previousElo, 0));
  const newElo = roundToInternal(toFiniteNumber(input.newElo, previousElo));
  const delta = roundToInternal(toFiniteNumber(input.delta, roundToInternal(newElo - previousElo)));

  return {
    playerId: input.playerId,
    previousElo,
    newElo,
    delta,
    reason,
  };
}

function normalizeTurn(input: unknown): Turn | null {
  if (!isRecord(input) || !isCourt(input.courtBefore) || !isCourt(input.courtAfter)) return null;
  const eliminatedPosition = toPosition(input.eliminatedPosition, 0);
  const killerPosition = toPosition(input.killerPosition, 0);
  const eloChanges = Array.isArray(input.eloChanges)
    ? input.eloChanges.map(normalizeEloChange).filter((c): c is NonNullable<typeof c> => c !== null)
    : [];

  return {
    turnNumber: toNonNegativeInt(input.turnNumber, 0),
    timestamp: toFiniteNumber(input.timestamp, Date.now()),
    courtBefore: input.courtBefore,
    eliminatedPlayerId:
      typeof input.eliminatedPlayerId === 'string'
        ? input.eliminatedPlayerId
        : input.courtBefore[eliminatedPosition],
    eliminatedPosition,
    killerPlayerId:
      typeof input.killerPlayerId === 'string' ? input.killerPlayerId : input.courtBefore[killerPosition],
    killerPosition,
    newPlayerId: typeof input.newPlayerId === 'string' ? input.newPlayerId : null,
    courtAfter: input.courtAfter,
    eloChanges,
  };
}

function normalizeGameSnapshot(input: unknown): GameSnapshot | null {
  if (!isRecord(input) || !isCourt(input.court) || !isRecord(input.players)) return null;
  return {
    players: normalizePlayersMap(input.players),
    court: input.court,
    turnNumber: toNonNegativeInt(input.turnNumber, 0),
  };
}

function normalizeTurnStateSnapshot(input: unknown): TurnStateSnapshot | null {
  if (!isRecord(input) || !isCourt(input.court) || !isRecord(input.players)) return null;
  return {
    players: normalizePlayersMap(input.players),
    court: input.court,
    turns: Array.isArray(input.turns)
      ? input.turns.map(normalizeTurn).filter((turn): turn is Turn => turn !== null)
      : [],
    turnNumber: toNonNegativeInt(input.turnNumber, 0),
    _lastSnapshot: normalizeGameSnapshot(input._lastSnapshot),
    recentEntrants: Array.isArray(input.recentEntrants)
      ? input.recentEntrants.filter((id): id is string => typeof id === 'string')
      : [],
    reserveLine: Array.isArray(input.reserveLine)
      ? input.reserveLine.filter((id): id is string => typeof id === 'string')
      : [],
    reserveHoldPlayerIds: Array.isArray(input.reserveHoldPlayerIds)
      ? input.reserveHoldPlayerIds.filter((id): id is string => typeof id === 'string')
      : typeof input.reserveHoldPlayerId === 'string'
        ? [input.reserveHoldPlayerId]
        : [],
  };
}

function normalizeCompletedGame(input: unknown): CompletedGame | null {
  if (!isRecord(input) || !isCourt(input.startingCourt) || !isCourt(input.finalCourt)) return null;
  return {
    id: toNonNegativeInt(input.id, 0),
    name: typeof input.name === 'string' ? input.name : null,
    startedAt: toFiniteNumber(input.startedAt, Date.now()),
    endedAt: toFiniteNumber(input.endedAt, Date.now()),
    turns: Array.isArray(input.turns)
      ? input.turns.map(normalizeTurn).filter((turn): turn is Turn => turn !== null)
      : [],
    startingCourt: input.startingCourt,
    finalCourt: input.finalCourt,
  };
}

function sanitizeWorkspaceState(input: unknown, fallbackId: string, fallbackName: string): WorkspaceState {
  const fallback = createWorkspaceState(fallbackId, fallbackName);
  if (!isRecord(input)) return fallback;

  return {
    id: typeof input.id === 'string' && input.id.length > 0 ? input.id : fallback.id,
    name: typeof input.name === 'string' && input.name.trim().length > 0 ? input.name.trim() : fallback.name,
    createdAt: toFiniteNumber(input.createdAt, fallback.createdAt),
    updatedAt: toFiniteNumber(input.updatedAt, fallback.updatedAt),
    players: normalizePlayersMap(input.players),
    court: isCourt(input.court) ? input.court : fallback.court,
    turns: Array.isArray(input.turns)
      ? input.turns.map(normalizeTurn).filter((turn): turn is Turn => turn !== null)
      : fallback.turns,
    turnNumber: toNonNegativeInt(input.turnNumber, fallback.turnNumber),
    gameInProgress: typeof input.gameInProgress === 'boolean' ? input.gameInProgress : fallback.gameInProgress,
    gameStartedAt:
      typeof input.gameStartedAt === 'number' || input.gameStartedAt === null
        ? input.gameStartedAt
        : fallback.gameStartedAt,
    gameHistory: Array.isArray(input.gameHistory)
      ? input.gameHistory
          .map(normalizeCompletedGame)
          .filter((game): game is CompletedGame => game !== null)
      : fallback.gameHistory,
    _lastSnapshot: normalizeGameSnapshot(input._lastSnapshot),
    isInitialized: typeof input.isInitialized === 'boolean' ? input.isInitialized : fallback.isInitialized,
    theme: input.theme === 'light' ? 'light' : 'dark',
    requireKiller: typeof input.requireKiller === 'boolean' ? input.requireKiller : fallback.requireKiller,
    showReserveButtons:
      typeof input.showReserveButtons === 'boolean'
        ? input.showReserveButtons
        : fallback.showReserveButtons,
    trackReserveLine:
      typeof input.trackReserveLine === 'boolean' ? input.trackReserveLine : fallback.trackReserveLine,
    reserveLine: Array.isArray(input.reserveLine)
      ? input.reserveLine.filter((id): id is string => typeof id === 'string')
      : fallback.reserveLine,
    reserveHoldPlayerIds: Array.isArray(input.reserveHoldPlayerIds)
      ? input.reserveHoldPlayerIds.filter((id): id is string => typeof id === 'string')
      : typeof input.reserveHoldPlayerId === 'string'
        ? [input.reserveHoldPlayerId]
        : fallback.reserveHoldPlayerIds,
    undoStack: Array.isArray(input.undoStack)
      ? input.undoStack
          .map(normalizeTurnStateSnapshot)
          .filter((snap): snap is TurnStateSnapshot => snap !== null)
      : fallback.undoStack,
    redoStack: Array.isArray(input.redoStack)
      ? input.redoStack
          .map(normalizeTurnStateSnapshot)
          .filter((snap): snap is TurnStateSnapshot => snap !== null)
      : fallback.redoStack,
    recentEntrants: Array.isArray(input.recentEntrants)
      ? input.recentEntrants.filter((id): id is string => typeof id === 'string')
      : fallback.recentEntrants,
    hiddenPlayerIds: Array.isArray(input.hiddenPlayerIds)
      ? input.hiddenPlayerIds.filter((id): id is string => typeof id === 'string')
      : fallback.hiddenPlayerIds,
    analytics: sanitizeAnalyticsState(input.analytics),
  };
}

function isLegacySingleWorkspaceState(input: Record<string, unknown>): boolean {
  return (
    'players' in input ||
    'gameHistory' in input ||
    'turns' in input ||
    'requireKiller' in input ||
    'showReserveButtons' in input ||
    'theme' in input
  );
}

function migrateLegacyStateToWorkspace(input: Record<string, unknown>): PersistedGameState {
  const now = Date.now();
  const workspace = sanitizeWorkspaceState(
    {
      ...input,
      id: DEFAULT_WORKSPACE_ID,
      name: DEFAULT_WORKSPACE_NAME,
      createdAt: now,
      updatedAt: now,
    },
    DEFAULT_WORKSPACE_ID,
    DEFAULT_WORKSPACE_NAME
  );

  return {
    version: STATE_VERSION,
    activeWorkspaceId: workspace.id,
    workspaces: {
      [workspace.id]: workspace,
    },
  };
}

function normalizeWorkspaceName(name: string): string {
  const trimmed = name.trim();
  return trimmed.length > 0 ? trimmed : DEFAULT_WORKSPACE_NAME;
}

function makeWorkspaceId(existing: Record<string, WorkspaceState>, name: string): string {
  const slug =
    name
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '') || 'workspace';
  let candidate = `${slug}-${Math.random().toString(36).slice(2, 8)}`;
  while (existing[candidate]) {
    candidate = `${slug}-${Math.random().toString(36).slice(2, 8)}`;
  }
  return candidate;
}

function updateWorkspace(
  state: PersistedGameState,
  workspaceId: string,
  updater: (workspace: WorkspaceState) => WorkspaceState
): PersistedGameState {
  const workspace = state.workspaces[workspaceId];
  if (!workspace) return state;
  const updated = updater(workspace);
  return {
    ...state,
    workspaces: {
      ...state.workspaces,
      [workspaceId]: {
        ...updated,
        updatedAt: Date.now(),
      },
    },
  };
}

function createTurnStateSnapshot(workspace: WorkspaceState): TurnStateSnapshot {
  return {
    players: JSON.parse(JSON.stringify(workspace.players)),
    court: [...workspace.court] as [string, string, string, string],
    turns: JSON.parse(JSON.stringify(workspace.turns)),
    turnNumber: workspace.turnNumber,
    _lastSnapshot: workspace._lastSnapshot
      ? {
          players: JSON.parse(JSON.stringify(workspace._lastSnapshot.players)),
          court: [...workspace._lastSnapshot.court] as [string, string, string, string],
          turnNumber: workspace._lastSnapshot.turnNumber,
        }
      : null,
    recentEntrants: [...workspace.recentEntrants],
    reserveLine: [...workspace.reserveLine],
    reserveHoldPlayerIds: [...workspace.reserveHoldPlayerIds],
  };
}

export function selectActiveWorkspace(state: PersistedGameState): WorkspaceState {
  return (
    state.workspaces[state.activeWorkspaceId] ??
    Object.values(state.workspaces)[0] ??
    createWorkspaceState(DEFAULT_WORKSPACE_ID, DEFAULT_WORKSPACE_NAME)
  );
}

export function getPersistedGameState(state: PersistedGameState): PersistedGameState {
  return {
    version: STATE_VERSION,
    activeWorkspaceId: state.activeWorkspaceId,
    workspaces: state.workspaces,
  };
}

export function sanitizePersistedGameState(input: unknown): PersistedGameState {
  const fallback = createInitialState();
  if (!isRecord(input)) return fallback;

  if (isLegacySingleWorkspaceState(input)) {
    return migrateLegacyStateToWorkspace(input);
  }

  const rawWorkspaces = isRecord(input.workspaces) ? input.workspaces : null;
  if (!rawWorkspaces) return fallback;

  const workspaces = Object.entries(rawWorkspaces).reduce<Record<string, WorkspaceState>>((acc, [id, value]) => {
    const sanitized = sanitizeWorkspaceState(value, id, `Workspace ${Object.keys(acc).length + 1}`);
    acc[id] = { ...sanitized, id };
    return acc;
  }, {});

  const keys = Object.keys(workspaces);
  if (keys.length === 0) return fallback;

  const activeWorkspaceId =
    typeof input.activeWorkspaceId === 'string' && workspaces[input.activeWorkspaceId]
      ? input.activeWorkspaceId
      : keys[0];

  return {
    version:
      typeof input.version === 'number' && Number.isFinite(input.version)
        ? input.version
        : STATE_VERSION,
    activeWorkspaceId,
    workspaces,
  };
}

export const useGameStore = create<GameStore>((set, get) => ({
  ...createInitialState(),

  hydrateFromRemote: (state) => {
    set(sanitizePersistedGameState(state));
  },

  switchWorkspace: (workspaceId) => {
    const state = get();
    if (!state.workspaces[workspaceId]) return;
    set({ activeWorkspaceId: workspaceId });
  },

  createWorkspace: (name) => {
    const state = get();
    const workspaceName = normalizeWorkspaceName(name ?? `Workspace ${Object.keys(state.workspaces).length + 1}`);
    const id = makeWorkspaceId(state.workspaces, workspaceName);
    const nextWorkspace = createWorkspaceState(id, workspaceName);

    set({
      activeWorkspaceId: id,
      workspaces: {
        ...state.workspaces,
        [id]: nextWorkspace,
      },
    });

    return id;
  },

  renameWorkspace: (workspaceId, name) => {
    const state = get();
    const trimmed = name.trim();
    if (!trimmed || !state.workspaces[workspaceId]) return;

    set(
      updateWorkspace(state, workspaceId, (workspace) => ({
        ...workspace,
        name: trimmed,
      }))
    );
  },

  deleteWorkspace: (workspaceId) => {
    const state = get();
    if (!state.workspaces[workspaceId]) return;
    if (Object.keys(state.workspaces).length <= 1) return;

    const nextWorkspaces = { ...state.workspaces };
    delete nextWorkspaces[workspaceId];
    const nextIds = Object.keys(nextWorkspaces);

    set({
      workspaces: nextWorkspaces,
      activeWorkspaceId:
        state.activeWorkspaceId === workspaceId ? nextIds[0] : state.activeWorkspaceId,
    });
  },

  setTheme: (theme) => {
    const state = get();
    set(
      updateWorkspace(state, state.activeWorkspaceId, (workspace) => ({
        ...workspace,
        theme,
      }))
    );
  },

  setRequireKiller: (requireKiller) => {
    const state = get();
    set(
      updateWorkspace(state, state.activeWorkspaceId, (workspace) => ({
        ...workspace,
        requireKiller,
      }))
    );
  },

  setShowReserveButtons: (showReserveButtons) => {
    const state = get();
    set(
      updateWorkspace(state, state.activeWorkspaceId, (workspace) => ({
        ...workspace,
        showReserveButtons,
      }))
    );
  },

  setTrackReserveLine: (trackReserveLine) => {
    const state = get();
    set(
      updateWorkspace(state, state.activeWorkspaceId, (workspace) => ({
        ...workspace,
        trackReserveLine,
      }))
    );
  },

  addToReserveLine: (name, index) => {
    const state = get();
    const workspace = selectActiveWorkspace(state);
    const trimmed = name.trim();
    if (!trimmed) return;
    const playerId = trimmed.toLowerCase();
    if (workspace.court.includes(playerId)) return;

    const players = workspace.players[playerId]
      ? workspace.players
      : {
          ...workspace.players,
          [playerId]: {
            id: playerId,
            name: trimmed,
            elo: 1000,
            gamesPlayed: 0,
            eliminations: 0,
            timesEliminated: 0,
            createdAt: Date.now(),
          },
        };

    const reserveLine = workspace.reserveLine.filter((id) => id !== playerId);
    if (workspace.reserveHoldPlayerIds.includes(playerId)) {
      set(
        updateWorkspace(state, state.activeWorkspaceId, (currentWorkspace) => ({
          ...currentWorkspace,
          players,
          reserveHoldPlayerIds: currentWorkspace.reserveHoldPlayerIds.filter((id) => id !== playerId),
          reserveLine: [playerId, ...reserveLine],
        }))
      );
      return;
    }

    const boundedIndex =
      typeof index === 'number' && Number.isFinite(index)
        ? Math.min(Math.max(0, Math.trunc(index)), reserveLine.length)
        : reserveLine.length;
    reserveLine.splice(boundedIndex, 0, playerId);

    set(
      updateWorkspace(state, state.activeWorkspaceId, (currentWorkspace) => ({
        ...currentWorkspace,
        players,
        reserveLine,
      }))
    );
  },

  moveReserveLinePlayer: (fromIndex, toIndex) => {
    const state = get();
    const workspace = selectActiveWorkspace(state);
    if (fromIndex === toIndex) return;
    if (fromIndex < 0 || toIndex < 0) return;
    if (fromIndex >= workspace.reserveLine.length || toIndex >= workspace.reserveLine.length) return;

    const reserveLine = [...workspace.reserveLine];
    const [moved] = reserveLine.splice(fromIndex, 1);
    reserveLine.splice(toIndex, 0, moved);

    set(
      updateWorkspace(state, state.activeWorkspaceId, (currentWorkspace) => ({
        ...currentWorkspace,
        reserveLine,
      }))
    );
  },

  removeFromReserveLine: (playerId, holdTop) => {
    const state = get();
    const workspace = selectActiveWorkspace(state);
    const reserveLine = workspace.reserveLine.filter((id) => id !== playerId);

    set(
      updateWorkspace(state, state.activeWorkspaceId, (currentWorkspace) => ({
        ...currentWorkspace,
        reserveLine,
        reserveHoldPlayerIds: holdTop
          ? [...currentWorkspace.reserveHoldPlayerIds.filter((id) => id !== playerId), playerId]
          : currentWorkspace.reserveHoldPlayerIds.filter((id) => id !== playerId),
      }))
    );
  },

  clearReserveHold: (playerId) => {
    const state = get();
    set(
      updateWorkspace(state, state.activeWorkspaceId, (workspace) => ({
        ...workspace,
        reserveHoldPlayerIds: playerId
          ? workspace.reserveHoldPlayerIds.filter((id) => id !== playerId)
          : [],
      }))
    );
  },

  setAnalyticsFilter: (next) => {
    const state = get();
    set(
      updateWorkspace(state, state.activeWorkspaceId, (workspace) => ({
        ...workspace,
        analytics: {
          ...workspace.analytics,
          filter: sanitizeAnalyticsFilter(next),
        },
      }))
    );
  },

  setSelectedPlayers: (next) => {
    const state = get();
    set(
      updateWorkspace(state, state.activeWorkspaceId, (workspace) => ({
        ...workspace,
        analytics: {
          ...workspace.analytics,
          selectedPlayers: [...next],
          selectedPlayersUseDefault: false,
        },
      }))
    );
  },

  setH2hSort: (next) => {
    const state = get();
    set(
      updateWorkspace(state, state.activeWorkspaceId, (workspace) => ({
        ...workspace,
        analytics: {
          ...workspace.analytics,
          h2hSort: next,
        },
      }))
    );
  },

  setH2hPlayers: (next) => {
    const state = get();
    set(
      updateWorkspace(state, state.activeWorkspaceId, (workspace) => ({
        ...workspace,
        analytics: {
          ...workspace.analytics,
          h2hPlayers: [...next],
        },
      }))
    );
  },

  setTrendWindow: (next) => {
    const state = get();
    set(
      updateWorkspace(state, state.activeWorkspaceId, (workspace) => ({
        ...workspace,
        analytics: {
          ...workspace.analytics,
          trendWindow: next,
        },
      }))
    );
  },

  setTableRowsVisible: (next) => {
    const state = get();
    set(
      updateWorkspace(state, state.activeWorkspaceId, (workspace) => ({
        ...workspace,
        analytics: {
          ...workspace.analytics,
          tableRowsVisible: Math.max(1, Math.floor(next)),
        },
      }))
    );
  },

  setH2hRowsVisible: (next) => {
    const state = get();
    set(
      updateWorkspace(state, state.activeWorkspaceId, (workspace) => ({
        ...workspace,
        analytics: {
          ...workspace.analytics,
          h2hRowsVisible: Math.max(1, Math.floor(next)),
        },
      }))
    );
  },

  initializeGame: (names) => {
    const state = get();
    const workspace = selectActiveWorkspace(state);
    const players: Record<string, Player> = { ...workspace.players };
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

    set(
      updateWorkspace(state, state.activeWorkspaceId, (currentWorkspace) => ({
        ...currentWorkspace,
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
        reserveLine: currentWorkspace.reserveLine.filter((id) => !court.includes(id)),
        hiddenPlayerIds: currentWorkspace.hiddenPlayerIds.filter((id) => !court.includes(id)),
      }))
    );
  },

  recordTurn: (eliminatedPos, killerPos, newPlayerName) => {
    const state = get();
    const workspace = selectActiveWorkspace(state);
    if (!workspace.gameInProgress) return;
    if (eliminatedPos < 0 || eliminatedPos > 3 || killerPos < 0 || killerPos > 3) return;

    const trimmedReplacement = newPlayerName?.trim() ?? '';
    if (eliminatedPos !== 0) {
      if (!trimmedReplacement) return;
      if (workspace.court.includes(trimmedReplacement.toLowerCase())) return;
    }

    const snapshot: GameSnapshot = {
      players: JSON.parse(JSON.stringify(workspace.players)),
      court: [...workspace.court] as [string, string, string, string],
      turnNumber: workspace.turnNumber,
    };
    const turnStateSnapshot = createTurnStateSnapshot(workspace);

    let result;
    try {
      result = processTurn(
        workspace.court,
        workspace.players,
        eliminatedPos,
        killerPos,
        trimmedReplacement || undefined,
        workspace.requireKiller
      );
    } catch {
      return;
    }

    const turn: Turn = {
      turnNumber: workspace.turnNumber,
      timestamp: Date.now(),
      courtBefore: [...workspace.court] as [string, string, string, string],
      eliminatedPlayerId: workspace.court[eliminatedPos],
      eliminatedPosition: eliminatedPos,
      killerPlayerId: workspace.court[killerPos],
      killerPosition: killerPos,
      newPlayerId: result.newPlayer?.id ?? null,
      courtAfter: [...result.newCourt] as [string, string, string, string],
      eloChanges: result.eloChanges,
    };

    const updatedRecentEntrants = result.newPlayer
      ? [
          result.newPlayer.id,
          ...workspace.recentEntrants.filter((id) => id !== result.newPlayer?.id),
        ].slice(0, MAX_RECENT_ENTRANTS)
      : workspace.recentEntrants;

    let reserveLine = workspace.reserveLine;
    let reserveHoldPlayerIds = workspace.reserveHoldPlayerIds;
    if (workspace.trackReserveLine) {
      reserveLine = reserveLine.filter((id) => !result.newCourt.includes(id));
      if (result.newPlayer?.id) {
        reserveLine = reserveLine.filter((id) => id !== result.newPlayer?.id);
        reserveHoldPlayerIds = reserveHoldPlayerIds.filter((id) => id !== result.newPlayer?.id);
      }
      if (eliminatedPos !== 0) {
        const eliminatedId = workspace.court[eliminatedPos];
        if (!reserveLine.includes(eliminatedId)) reserveLine = [...reserveLine, eliminatedId];
      }
    }

    const activeIds = new Set(result.newCourt);
    const hiddenPlayerIds = workspace.hiddenPlayerIds.filter(
      (id) => !activeIds.has(id) && id !== result.newPlayer?.id
    );

    set(
      updateWorkspace(state, state.activeWorkspaceId, (currentWorkspace) => ({
        ...currentWorkspace,
        court: result.newCourt,
        players: result.updatedPlayers,
        turns: [...workspace.turns, turn],
        turnNumber: workspace.turnNumber + 1,
        _lastSnapshot: snapshot,
        undoStack: [...workspace.undoStack, turnStateSnapshot].slice(-MAX_TURN_STACK),
        redoStack: [],
        recentEntrants: updatedRecentEntrants,
        reserveLine,
        reserveHoldPlayerIds,
        hiddenPlayerIds,
      }))
    );
  },

  undoLastTurn: () => {
    const state = get();
    const workspace = selectActiveWorkspace(state);
    if (workspace.undoStack.length === 0) return;

    const previous = workspace.undoStack[workspace.undoStack.length - 1];
    const currentSnapshot = createTurnStateSnapshot(workspace);

    set(
      updateWorkspace(state, state.activeWorkspaceId, (currentWorkspace) => ({
        ...currentWorkspace,
        players: previous.players,
        court: previous.court,
        turns: previous.turns,
        turnNumber: previous.turnNumber,
        _lastSnapshot: previous._lastSnapshot,
        recentEntrants: previous.recentEntrants,
        reserveLine: previous.reserveLine,
        reserveHoldPlayerIds: previous.reserveHoldPlayerIds,
        undoStack: workspace.undoStack.slice(0, -1),
        redoStack: [...workspace.redoStack, currentSnapshot].slice(-MAX_TURN_STACK),
      }))
    );
  },

  redoLastTurn: () => {
    const state = get();
    const workspace = selectActiveWorkspace(state);
    if (workspace.redoStack.length === 0) return;

    const next = workspace.redoStack[workspace.redoStack.length - 1];
    const currentSnapshot = createTurnStateSnapshot(workspace);

    set(
      updateWorkspace(state, state.activeWorkspaceId, (currentWorkspace) => ({
        ...currentWorkspace,
        players: next.players,
        court: next.court,
        turns: next.turns,
        turnNumber: next.turnNumber,
        _lastSnapshot: next._lastSnapshot,
        recentEntrants: next.recentEntrants,
        reserveLine: next.reserveLine,
        reserveHoldPlayerIds: next.reserveHoldPlayerIds,
        redoStack: workspace.redoStack.slice(0, -1),
        undoStack: [...workspace.undoStack, currentSnapshot].slice(-MAX_TURN_STACK),
      }))
    );
  },

  endGame: () => {
    const state = get();
    const workspace = selectActiveWorkspace(state);
    if (!workspace.gameInProgress || workspace.turns.length === 0) return;

    const nextGameId = workspace.gameHistory.reduce((maxId, game) => Math.max(maxId, game.id), 0) + 1;
    const completedGame: CompletedGame = {
      id: nextGameId,
      name: null,
      startedAt: workspace.gameStartedAt ?? workspace.turns[0].timestamp,
      endedAt: Date.now(),
      turns: [...workspace.turns],
      startingCourt: workspace.turns[0].courtBefore,
      finalCourt: [...workspace.court] as [string, string, string, string],
    };

    set(
      updateWorkspace(state, state.activeWorkspaceId, (currentWorkspace) => ({
        ...currentWorkspace,
        gameHistory: [...workspace.gameHistory, completedGame],
        court: ['', '', '', ''],
        turns: [],
        turnNumber: 0,
        gameInProgress: false,
        gameStartedAt: null,
        _lastSnapshot: null,
        undoStack: [],
        redoStack: [],
        reserveLine: workspace.reserveLine.filter((id) => !workspace.court.includes(id)),
      }))
    );
  },

  resetAllData: () => {
    set(createInitialState());
  },

  deleteGameFromHistory: (gameId) => {
    const state = get();
    const workspace = selectActiveWorkspace(state);
    set(
      updateWorkspace(state, state.activeWorkspaceId, (currentWorkspace) => ({
        ...currentWorkspace,
        gameHistory: workspace.gameHistory.filter((game) => game.id !== gameId),
      }))
    );
  },

  renameGameInHistory: (gameId, name) => {
    const state = get();
    const workspace = selectActiveWorkspace(state);
    const trimmed = name.trim();
    set(
      updateWorkspace(state, state.activeWorkspaceId, (currentWorkspace) => ({
        ...currentWorkspace,
        gameHistory: workspace.gameHistory.map((game) =>
          game.id === gameId ? { ...game, name: trimmed.length > 0 ? trimmed : null } : game
        ),
      }))
    );
  },

  renamePlayer: (oldId, newName) => {
    const state = get();
    const workspace = selectActiveWorkspace(state);
    const trimmedName = newName.trim();
    if (!trimmedName || !workspace.players[oldId]) return;

    const newId = trimmedName.toLowerCase();

    if (newId === oldId) {
      const updatedPlayers = { ...workspace.players };
      updatedPlayers[oldId] = { ...updatedPlayers[oldId], name: trimmedName };
      set(
        updateWorkspace(state, state.activeWorkspaceId, (currentWorkspace) => ({
          ...currentWorkspace,
          players: updatedPlayers,
        }))
      );
      return;
    }

    if (workspace.players[newId]) return;

    const updatedPlayers = { ...workspace.players };
    const player = { ...updatedPlayers[oldId], id: newId, name: trimmedName };
    delete updatedPlayers[oldId];
    updatedPlayers[newId] = player;

    const mapId = (id: string) => (id === oldId ? newId : id);
    const mapCourt = (c: [string, string, string, string]) =>
      c.map(mapId) as [string, string, string, string];

    const newCourt = workspace.gameInProgress ? mapCourt(workspace.court) : workspace.court;

    const newTurns = workspace.turns.map((turn) => ({
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

    const newGameHistory = workspace.gameHistory.map((game) => ({
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

    const newSnapshot = workspace._lastSnapshot
      ? {
          ...workspace._lastSnapshot,
          players: Object.fromEntries(
            Object.entries(workspace._lastSnapshot.players).map(([k, v]) =>
              k === oldId
                ? [newId, { ...v, id: newId, name: trimmedName }]
                : [k, v]
            )
          ),
          court: mapCourt(workspace._lastSnapshot.court),
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
      reserveLine: snap.reserveLine.map(mapId),
      reserveHoldPlayerIds: snap.reserveHoldPlayerIds.map(mapId),
    });

    set(
      updateWorkspace(state, state.activeWorkspaceId, (currentWorkspace) => ({
        ...currentWorkspace,
        players: updatedPlayers,
        court: newCourt,
        turns: newTurns,
        gameHistory: newGameHistory,
        _lastSnapshot: newSnapshot,
        undoStack: workspace.undoStack.map(mapTurnStateSnapshot),
        redoStack: workspace.redoStack.map(mapTurnStateSnapshot),
        recentEntrants: workspace.recentEntrants.map(mapId),
        reserveLine: workspace.reserveLine.map(mapId),
        reserveHoldPlayerIds: workspace.reserveHoldPlayerIds.map(mapId),
        hiddenPlayerIds: workspace.hiddenPlayerIds.map(mapId),
      }))
    );
  },

  hidePlayer: (playerId) => {
    const state = get();
    const workspace = selectActiveWorkspace(state);
    if (!workspace.players[playerId]) return;
    if (workspace.court.includes(playerId)) return;
    if (workspace.hiddenPlayerIds.includes(playerId)) return;

    set(
      updateWorkspace(state, state.activeWorkspaceId, (currentWorkspace) => ({
        ...currentWorkspace,
        hiddenPlayerIds: [...workspace.hiddenPlayerIds, playerId],
      }))
    );
  },
}));
