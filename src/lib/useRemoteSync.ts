import { useEffect, useMemo, useRef, useState } from 'react';
import {
  loadRemoteState,
  saveRemoteState,
  syncPublishedWorkspaceSnapshot,
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

export function useRemoteSync(
  user: SupabaseUser | null,
  session: SupabaseSession | null,
  workspaceId: string,
  workspaceName: string
): SyncStatus {
  const [status, setStatus] = useState<SyncStatus>('idle');
  const loadedRef = useRef(false);

  const identity = useMemo(() => {
    if (!user || !session) return null;
    return `${user.id}:${workspaceId}:${session.accessToken.slice(0, 12)}`;
  }, [user, session, workspaceId]);

  useEffect(() => {
    let active = true;
    loadedRef.current = false;

    if (!user || !session) {
      return;
    }

    // Reset store when switching workspace so stale data is not shown.
    useGameStore.getState().resetAllData();
    queueMicrotask(() => setStatus('loading'));

    (async () => {
      try {
        const remote = await loadRemoteState(user.id, workspaceId, session);
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
  }, [identity, user, session, workspaceId]);

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
          await saveRemoteState(user.id, workspaceId, workspaceName, payloadState, session);
          await syncPublishedWorkspaceSnapshot(user.id, workspaceId, workspaceName, payloadState, session).catch(
            () => undefined
          );
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
  }, [identity, user, session, workspaceId, workspaceName]);

  return status;
}
