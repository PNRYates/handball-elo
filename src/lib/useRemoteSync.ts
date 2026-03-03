import { useEffect, useMemo, useRef, useState } from 'react';
import {
  loadRemoteState,
  saveRemoteState,
  type SupabaseSession,
  type SupabaseUser,
} from './supabaseRest';
import {
  getPersistedGameState,
  sanitizePersistedGameState,
  useGameStore,
  type PersistedGameState,
} from '../store/gameStore';

export type SyncStatus = 'idle' | 'loading' | 'saving' | 'error';

const SAVE_DEBOUNCE_MS = 700;

export function useRemoteSync(user: SupabaseUser | null, session: SupabaseSession | null): SyncStatus {
  const [status, setStatus] = useState<SyncStatus>('idle');
  const loadedRef = useRef(false);

  const identity = useMemo(() => {
    if (!user || !session) return null;
    return `${user.id}:${session.accessToken.slice(0, 12)}`;
  }, [user, session]);

  useEffect(() => {
    let active = true;
    loadedRef.current = false;

    if (!user || !session) {
      return;
    }

    queueMicrotask(() => setStatus('loading'));

    (async () => {
      try {
        const remote = await loadRemoteState(user.id, session);
        if (!active) return;
        if (remote) {
          useGameStore.getState().hydrateFromRemote(sanitizePersistedGameState(remote));
        }
        loadedRef.current = true;
        setStatus('idle');
      } catch {
        if (!active) return;
        loadedRef.current = true;
        setStatus('error');
      }
    })();

    return () => {
      active = false;
      loadedRef.current = false;
    };
  }, [identity, user, session]);

  useEffect(() => {
    if (!user || !session) return;

    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    let lastSaved = '';

    const unsubscribe = useGameStore.subscribe((state) => {
      if (!loadedRef.current) return;

      const payloadState: PersistedGameState = getPersistedGameState(state);
      const payloadString = JSON.stringify(payloadState);
      if (payloadString === lastSaved) return;

      if (timeoutId) clearTimeout(timeoutId);
      timeoutId = setTimeout(async () => {
        try {
          setStatus('saving');
          await saveRemoteState(user.id, payloadState, session);
          lastSaved = payloadString;
          setStatus('idle');
        } catch {
          setStatus('error');
        }
      }, SAVE_DEBOUNCE_MS);
    });

    return () => {
      unsubscribe();
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [identity, user, session]);

  return status;
}
