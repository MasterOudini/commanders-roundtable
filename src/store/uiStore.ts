import { create } from 'zustand';

// Screen state + the two flags the choreographer needs.
//
// Screen switching is a hash + this store, not a router library: ~8 screens, no
// nested routes, no URL sharing, no deep links. A router would be a dependency
// earning nothing.
//
// ⚠️ `screen` lives in a store rather than in App's useState for a specific
// reason beyond tidiness: dev handles must never close over component state (see
// the note in App.tsx — a captured setter from a replaced HMR instance silently
// did nothing, and the probe reported "the screen has no cards", which is
// indistinguishable from a render bug). A store read is always live.

export type ScreenId =
  | 'home'
  | 'decks'
  | 'carddb'
  | 'solo'
  | 'multiplayer'
  | 'table'
  | 'settings'
  | 'about'
  | 'cards'
  | 'tokens'
  | 'flight'
  | 'beats';

interface UiState {
  screen: ScreenId;
  /** A game is in progress, so the table keeps consuming events while hidden. */
  tableLive: boolean;
  /**
   * The table is the visible screen. When false the choreographer switches to
   * digest mode: it keeps consuming events and committing state, it just stops
   * flying clones. ⚠️ It must never PAUSE — that desyncs.
   */
  tableVisible: boolean;
  setScreen: (s: ScreenId) => void;
  /**
   * Go to a screen from inside the app.
   *
   * ⚠️ The HASH is the source of truth and this store mirrors it (App.tsx), so a
   * caller that set only the store left the two disagreeing: starting a game
   * from the Play-solo screen showed the table while the hash still said
   * `#solo`, and a reload came back to the lobby of a game already running.
   * Setting BOTH is also what the nav bar does, and it must — assigning an
   * unchanged hash fires no `hashchange`, so the listener alone cannot be
   * relied on.
   */
  goto: (s: ScreenId) => void;
  setTableLive: (live: boolean) => void;
}

export const useUi = create<UiState>((set) => ({
  screen: 'home',
  tableLive: false,
  tableVisible: false,
  setScreen: (screen) => set({ screen, tableVisible: screen === 'table' }),
  goto: (screen) => {
    if (typeof window !== 'undefined') window.location.hash = screen;
    set({ screen, tableVisible: screen === 'table' });
  },
  setTableLive: (tableLive) => set({ tableLive }),
}));
