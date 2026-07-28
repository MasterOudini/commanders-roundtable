import { create } from 'zustand';
import type { CardDbProgress, CardDbStatus, ImageQueueStatus } from '../types/bridge';

// Mirrors the card-database worker's state into the UI.
//
// Progress arrives as an unsolicited push (the worker throttles it to ~3/s), so
// this store does not poll. It re-reads status after a sync settles, because the
// authoritative on-disk state lives in main, not here.

/** Data older than this prompts an update — the ban list ages with the data. */
export const STALE_AFTER_DAYS = 30;

interface CardDbState {
  status: CardDbStatus | null;
  progress: CardDbProgress | null;
  /** Art cache and download queue, refreshed alongside status. */
  images: ImageQueueStatus | null;
  syncing: boolean;
  error: string | null;
  /** True outside Electron, where there is no worker at all. */
  unavailable: boolean;

  refresh: () => Promise<void>;
  sync: (options?: { force?: boolean }) => Promise<void>;
  cancel: () => Promise<void>;
  restartWorker: () => Promise<void>;
  /** Subscribe to pushes; returns an unsubscribe for the caller's effect. */
  listen: () => () => void;
}

export const useCardDb = create<CardDbState>((set, get) => ({
  status: null,
  progress: null,
  images: null,
  syncing: false,
  error: null,
  unavailable: typeof window === 'undefined' || !window.crt,

  refresh: async () => {
    const bridge = window.crt;
    if (!bridge) {
      set({ unavailable: true });
      return;
    }
    try {
      // Card-database status and art-cache status together — one refresh, so the
      // screen can never show them disagreeing.
      const [status, images] = await Promise.all([
        bridge.cardDb.status(),
        bridge.images.status().catch(() => null),
      ]);
      set({ status, images, unavailable: false });
    } catch (e) {
      set({ error: e instanceof Error ? e.message : String(e) });
    }
  },

  sync: async (options) => {
    const bridge = window.crt;
    if (!bridge || get().syncing) return;
    set({ syncing: true, error: null, progress: null });
    try {
      const status = await bridge.cardDb.sync(options);
      set({ status });
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      // A cancel is a user action, not a failure to report as one.
      set({ error: /cancel/i.test(message) ? null : message });
    } finally {
      set({ syncing: false, progress: null });
      await get().refresh();
    }
  },

  cancel: async () => {
    await window.crt?.cardDb.cancel();
  },

  restartWorker: async () => {
    await window.crt?.cardDb.restart();
    await get().refresh();
  },

  listen: () => {
    const bridge = window.crt;
    if (!bridge) return () => {};
    let lastImageRefresh = 0;
    const offProgress = bridge.cardDb.onProgress((progress) => {
      set({ progress });
      // Art progress arrives ~3/s for minutes; refreshing the cache figure on
      // every event would mean a directory walk per tick. Throttle it.
      if (progress.phase === 'images' && Date.now() - lastImageRefresh > 2000) {
        lastImageRefresh = Date.now();
        void bridge.images.status().then((images) => set({ images })).catch(() => {});
      }
    });
    const offState = bridge.cardDb.onState(() => void get().refresh());
    return () => { offProgress(); offState(); };
  },
}));

/** Human-readable byte size. Cards data is tens of MB, so one decimal is enough. */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
