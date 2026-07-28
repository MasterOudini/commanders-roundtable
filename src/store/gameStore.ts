import { create } from 'zustand';
import { emptyView, type PlayerView } from '../view/types';

// The authoritative view. In M2 it is fed by fixture scenarios; in M3 by
// `src/engine/project.ts`. Nothing in `src/ui/` knows which.
//
// ⚠️ THE LAG MODEL. A group's view is committed HERE when that group's animation
// STARTS, not when it finishes and not when the whole batch arrives. So the state
// leads the animation by at most one group (~500 ms), never by a whole burst of
// twenty moves.
//
// The animation layer is ALLOWED to lag — it must, or the hand cannot re-fan while
// a card is still flying, which is the single most Arena-like thing about the
// table. What it is NOT allowed to do is gate input: every interactive surface
// reads this store, so clicks stay live mid-flight. Acting on a view that is one
// group stale is safe because legality is checked host-side; a rejected intent
// gets a shake on the control that sent it rather than a disabled button.

interface GameState {
  view: PlayerView;
  /**
   * Bumped by a hard sync (reconnect, snapshot). Every queued beat records the
   * epoch it was built in and is discarded if it no longer matches — one guard
   * that kills every async race across a resync.
   */
  epoch: number;
  /** Monotonic count of committed views, for probes and diagnostics. */
  commits: number;

  /** Normal path: commit the view for a group that is starting. */
  applyView: (view: PlayerView) => void;
  /** Hard sync. Bumps the epoch, which invalidates everything in flight. */
  applySnapshot: (view: PlayerView) => void;
  reset: (me?: string) => void;
}

export const useGame = create<GameState>((set, get) => ({
  view: emptyView(),
  epoch: 0,
  commits: 0,

  applyView: (view) => set({ view, commits: get().commits + 1 }),

  applySnapshot: (view) =>
    set({ view, epoch: get().epoch + 1, commits: get().commits + 1 }),

  reset: (me = 'p1') => set({ view: emptyView(me), epoch: get().epoch + 1, commits: 0 }),
}));
