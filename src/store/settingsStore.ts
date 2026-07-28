import { create } from 'zustand';
import type { AnimationSpeed, Settings } from '../types/bridge';

// Settings live in main (one schema-validated JSON file). This store is a
// hydrated mirror: read once at startup, write through the bridge, and keep the
// optimistic value so the UI never waits on a round trip.
//
// In a plain browser dev session (npm run dev, no Electron) window.crt is
// undefined, so the store falls back to defaults and writes go nowhere. That is
// deliberate — the UI must be developable without the shell.

const FALLBACK: Settings = {
  playerName: 'Player',
  relayUrl: '',
  allowedOrigins: [],
  animationSpeed: 'cinematic',
  autoTapMana: true,
  prefetchArtOnImport: true,
  imageTier: 'png',
};

/** Multiplier the choreographer divides every duration by. */
export const TIME_SCALE: Record<AnimationSpeed, number> = {
  cinematic: 1,
  brisk: 1.4,
  fast: 2.2,
  off: Infinity,
};

interface SettingsState {
  settings: Settings;
  hydrated: boolean;
  /** True when running outside Electron, so the UI can say so instead of lying. */
  ephemeral: boolean;
  hydrate: () => Promise<void>;
  update: (patch: Partial<Settings>) => Promise<void>;
  timeScale: () => number;
}

export const useSettings = create<SettingsState>((set, get) => ({
  settings: FALLBACK,
  hydrated: false,
  ephemeral: typeof window === 'undefined' || !window.crt,

  hydrate: async () => {
    const bridge = window.crt;
    if (!bridge) {
      set({ hydrated: true, ephemeral: true });
      return;
    }
    try {
      const settings = await bridge.settings.get();
      set({ settings, hydrated: true, ephemeral: false });
    } catch {
      // Main is unreachable — keep defaults rather than blocking the UI.
      set({ hydrated: true });
    }
  },

  update: async (patch) => {
    set({ settings: { ...get().settings, ...patch } }); // optimistic
    const bridge = window.crt;
    if (!bridge) return;
    try {
      set({ settings: await bridge.settings.set(patch) }); // authoritative
    } catch {
      /* keep the optimistic value; the next hydrate corrects it */
    }
  },

  timeScale: () => TIME_SCALE[get().settings.animationSpeed],
}));
