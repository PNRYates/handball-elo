import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import { loadLocalState, saveLocalState } from './localPersistence';
import { enqueueSync, loadQueue, saveQueue, clearQueue } from './syncQueue';

export type SyncStatus = 'idle' | 'loading' | 'saving' | 'error' | 'offline';

const SAVE_DEBOUNCE_MS = 700;
const QUEUE_RETRY_INTERVAL_MS = 30_000;

export function useRemoteSync(user: SupabaseUser | null, session: SupabaseSession | null): SyncStatus {
  const [status, setStatus] = useState<SyncStatus>('idle');
  const loadedRef = useRef(false);
  const localRevisionRef = useRef(0);
  const isOnlineRef = useRef(typeof navigator !== 'undefined' ? navigator.onLine : true);
  const flushingRef = useRef(false);

  // Stable refs for user/session so callbacks don't need to re-subscribe
  const userRef = useRef(user);
  const sessionRef = useRef(session);
  useEffect(() => {
    userRef.current = user;
    sessionRef.current = session;
  }, [user, session]);

  const identity = useMemo(() => {
    if (!user || !session) return null;
    return `${user.id}:${session.accessToken.slice(0, 12)}`;
  }, [user, session]);

  // ── Flush outbound queue ──────────────────────────────────────────────────
  const flushQueue = useCallback(async () => {
    const u = userRef.current;
    const s = sessionRef.current;
    if (!u || !s || flushingRef.current || !isOnlineRef.current) return;

    const queue = loadQueue();
    if (queue.length === 0) return;

    flushingRef.current = true;
    // Pick the most recent queued entry
    const latest = queue.reduce((a, b) => (a.localRevision >= b.localRevision ? a : b));
    try {
      setStatus('saving');
      await saveRemoteState(u.id, latest.payload, s);
      clearQueue();
      setStatus('idle');
    } catch {
      // Increment retry count but keep in queue
      const updated = queue.map((e) =>
        e.localRevision === latest.localRevision ? { ...e, retries: e.retries + 1 } : e,
      );
      saveQueue(updated);
      setStatus('error');
    } finally {
      flushingRef.current = false;
    }
  }, []);

  // ── Online / offline detection ────────────────────────────────────────────
  useEffect(() => {
    const handleOnline = () => {
      isOnlineRef.current = true;
      setStatus((prev) => (prev === 'offline' ? 'idle' : prev));
      void flushQueue();
    };
    const handleOffline = () => {
      isOnlineRef.current = false;
      setStatus('offline');
    };
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [flushQueue]);
  useEffect(() => {
    let active = true;
    loadedRef.current = false;

    if (!user || !session) {
      return;
    }

    // Immediately hydrate from local state so the UI is responsive before network
    const localEntry = loadLocalState();
    if (localEntry) {
      useGameStore.getState().hydrateFromRemote(localEntry.state);
      localRevisionRef.current = localEntry.localRevision;
    }

    queueMicrotask(() => setStatus('loading'));

    (async () => {
      try {
        const remote = await loadRemoteState(user.id, session);
        if (!active) return;

        if (remote) {
          const currentLocal = loadLocalState();
          const remoteIsNewer = !currentLocal || remote.updatedAt >= currentLocal.updatedAt;
          if (remoteIsNewer) {
            // Remote wins — hydrate and update local cache
            useGameStore.getState().hydrateFromRemote(sanitizePersistedGameState(remote.state));
            const rev = localRevisionRef.current + 1;
            localRevisionRef.current = rev;
            saveLocalState(getPersistedGameState(useGameStore.getState()), rev);
          }
          // else: local is newer — it will be pushed to remote on next store change
        }

        loadedRef.current = true;
        setStatus(isOnlineRef.current ? 'idle' : 'offline');

        // Drain any queued saves after a successful load
        void flushQueue();
      } catch {
        if (!active) return;
        loadedRef.current = true;
        // If we already have local state, silently continue offline/error
        setStatus(localEntry ? (isOnlineRef.current ? 'error' : 'offline') : 'error');
      }
    })();

    return () => {
      active = false;
      loadedRef.current = false;
    };
  }, [identity, user, session, flushQueue]);
  useEffect(() => {
    if (!user || !session) return;

    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    let lastSaved = '';

    const unsubscribe = useGameStore.subscribe((state) => {
      if (!loadedRef.current) return;

      const payloadState: PersistedGameState = getPersistedGameState(state);
      const payloadString = JSON.stringify(payloadState);
      if (payloadString === lastSaved) return;

      // Persist locally immediately (increment revision each save)
      const rev = localRevisionRef.current + 1;
      localRevisionRef.current = rev;
      const entry = saveLocalState(payloadState, rev);

      if (timeoutId) clearTimeout(timeoutId);
      timeoutId = setTimeout(async () => {
        try {
          setStatus('saving');
          await saveRemoteState(user.id, payloadState, session);
          lastSaved = payloadString;
          setStatus(isOnlineRef.current ? 'idle' : 'offline');
        } catch {
          // Enqueue the failed save for later retry
          enqueueSync(payloadState, entry.updatedAt, rev);
          setStatus(isOnlineRef.current ? 'error' : 'offline');
        }
      }, SAVE_DEBOUNCE_MS);
    });

    return () => {
      unsubscribe();
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [identity, user, session]);

  // ── Retry queue on window focus ───────────────────────────────────────────
  useEffect(() => {
    const handleFocus = () => void flushQueue();
    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [flushQueue]);

  // ── Periodic queue retry ──────────────────────────────────────────────────
  useEffect(() => {
    const intervalId = setInterval(() => void flushQueue(), QUEUE_RETRY_INTERVAL_MS);
    return () => clearInterval(intervalId);
  }, [flushQueue]);

  return status;
}
