import type { PersistedGameState } from '../store/gameStore';

const SESSION_STORAGE_KEY = 'handball-elo-session';
const EXPIRY_BUFFER_SECONDS = 60;

export interface SupabaseSession {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  tokenType: string;
}

export interface SupabaseUser {
  id: string;
  email?: string;
}

function getEnv(name: string): string {
  const value = import.meta.env[name as keyof ImportMetaEnv];
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(`Missing env var: ${name}`);
  }
  return value;
}

function getSupabaseUrl(): string {
  return getEnv('VITE_SUPABASE_URL');
}

function getSupabaseAnonKey(): string {
  return getEnv('VITE_SUPABASE_ANON_KEY');
}

function getStoredSession(): SupabaseSession | null {
  const raw = localStorage.getItem(SESSION_STORAGE_KEY);
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as SupabaseSession;
    if (
      typeof parsed.accessToken !== 'string' ||
      typeof parsed.refreshToken !== 'string' ||
      typeof parsed.expiresAt !== 'number' ||
      typeof parsed.tokenType !== 'string'
    ) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function storeSession(session: SupabaseSession): void {
  localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
}

function clearStoredSession(): void {
  localStorage.removeItem(SESSION_STORAGE_KEY);
}

function parseHashSession(): SupabaseSession | null {
  if (!window.location.hash.startsWith('#')) return null;

  const params = new URLSearchParams(window.location.hash.slice(1));
  const accessToken = params.get('access_token');
  const refreshToken = params.get('refresh_token');
  const expiresIn = params.get('expires_in');
  const tokenType = params.get('token_type') ?? 'bearer';

  if (!accessToken || !refreshToken || !expiresIn) {
    return null;
  }

  const expiresAt = Math.floor(Date.now() / 1000) + Number(expiresIn);
  if (!Number.isFinite(expiresAt)) return null;

  // Remove OAuth hash params from URL after successful parse.
  history.replaceState(null, '', window.location.pathname + window.location.search);

  return {
    accessToken,
    refreshToken,
    expiresAt,
    tokenType,
  };
}

async function refreshSession(refreshToken: string): Promise<SupabaseSession | null> {
  const res = await fetch(`${getSupabaseUrl()}/auth/v1/token?grant_type=refresh_token`, {
    method: 'POST',
    headers: {
      apikey: getSupabaseAnonKey(),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ refresh_token: refreshToken }),
  });

  if (!res.ok) return null;

  const data = (await res.json()) as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
    token_type?: string;
  };

  if (!data.access_token || !data.refresh_token || typeof data.expires_in !== 'number') {
    return null;
  }

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt: Math.floor(Date.now() / 1000) + data.expires_in,
    tokenType: data.token_type ?? 'bearer',
  };
}

async function ensureFreshSession(session: SupabaseSession): Promise<SupabaseSession | null> {
  const now = Math.floor(Date.now() / 1000);
  if (session.expiresAt - EXPIRY_BUFFER_SECONDS > now) {
    return session;
  }

  const refreshed = await refreshSession(session.refreshToken);
  if (!refreshed) return null;

  storeSession(refreshed);
  return refreshed;
}

export async function getCurrentSession(): Promise<SupabaseSession | null> {
  const hashSession = parseHashSession();
  if (hashSession) {
    storeSession(hashSession);
  }

  const stored = hashSession ?? getStoredSession();
  if (!stored) return null;

  const valid = await ensureFreshSession(stored);
  if (!valid) {
    clearStoredSession();
    return null;
  }

  return valid;
}

export function loginWithGoogle(): void {
  const redirectTo = `${window.location.origin}${window.location.pathname}`;
  const authorizeUrl = new URL(`${getSupabaseUrl()}/auth/v1/authorize`);
  authorizeUrl.searchParams.set('provider', 'google');
  authorizeUrl.searchParams.set('redirect_to', redirectTo);

  window.location.href = authorizeUrl.toString();
}

export async function logout(session: SupabaseSession | null): Promise<void> {
  if (session) {
    await fetch(`${getSupabaseUrl()}/auth/v1/logout`, {
      method: 'POST',
      headers: {
        apikey: getSupabaseAnonKey(),
        Authorization: `Bearer ${session.accessToken}`,
      },
    });
  }

  clearStoredSession();
}

export async function getCurrentUser(session: SupabaseSession): Promise<SupabaseUser | null> {
  const res = await fetch(`${getSupabaseUrl()}/auth/v1/user`, {
    headers: {
      apikey: getSupabaseAnonKey(),
      Authorization: `Bearer ${session.accessToken}`,
    },
  });

  if (!res.ok) return null;

  const user = (await res.json()) as { id?: string; email?: string };
  if (!user.id) return null;

  return {
    id: user.id,
    email: user.email,
  };
}

function restHeaders(session: SupabaseSession): HeadersInit {
  return {
    apikey: getSupabaseAnonKey(),
    Authorization: `Bearer ${session.accessToken}`,
    'Content-Type': 'application/json',
  };
}

export async function loadRemoteState(
  userId: string,
  session: SupabaseSession
): Promise<PersistedGameState | null> {
  const query = new URL(`${getSupabaseUrl()}/rest/v1/user_game_state`);
  query.searchParams.set('select', 'state');
  query.searchParams.set('user_id', `eq.${userId}`);
  query.searchParams.set('limit', '1');

  const res = await fetch(query.toString(), {
    headers: restHeaders(session),
  });

  if (!res.ok) {
    throw new Error('Failed to load game state from DB');
  }

  const rows = (await res.json()) as Array<{ state?: PersistedGameState }>;
  if (rows.length === 0 || !rows[0].state) {
    return null;
  }

  return rows[0].state;
}

export async function saveRemoteState(
  userId: string,
  state: PersistedGameState,
  session: SupabaseSession
): Promise<void> {
  const res = await fetch(`${getSupabaseUrl()}/rest/v1/user_game_state`, {
    method: 'POST',
    headers: {
      ...restHeaders(session),
      Prefer: 'resolution=merge-duplicates,return=minimal',
    },
    body: JSON.stringify({
      user_id: userId,
      state,
      updated_at: new Date().toISOString(),
    }),
  });

  if (!res.ok) {
    throw new Error('Failed to save game state to DB');
  }
}
