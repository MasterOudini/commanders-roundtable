import { create } from 'zustand';
import type { CardData } from '../data/cardTypes';
import type { InstanceId } from '../view/types';

// The card currently being dragged out of the hand, in a store rather than in
// component state.
//
// ⚠️ Same VERIFIABILITY reason as `handStore`, and it is the whole shape of this
// file: a drag cannot be tested with synthetic pointer events in this workspace.
// If the real mouse happens to be over the Electron window, genuine and synthetic
// pointermoves interleave and corrupt the gesture — a documented trap in
// AGENTS.md. A battery therefore drives `begin`/`move`/`release` directly, which
// runs exactly the code path a real pointer runs, minus the interleaving.
//
// ⚠️ It also obeys the convergence invariant that `animStore` obeys: this store
// may only HIDE or DECORATE. It never holds card→zone truth. A drag that is
// interrupted, refused or lost leaves a card hidden in the fan for at most one
// return animation — never in the wrong zone.
//
// The ghost's position is the ghost's TOP-LEFT in viewport px, not the pointer
// position. That is deliberate: the rect the player let go over is exactly what
// the flight layer needs as a source rect, so the drop hands it over unchanged
// (see `setDropOrigin` in rectRegistry).

export type DragPhase =
  | 'idle'
  /** Following the pointer. */
  | 'dragging'
  /** Let go over the drop zone: parked where it was dropped, waiting on the game. */
  | 'released'
  /** Flying back to its slot in the fan — refused, cancelled, or dropped nowhere. */
  | 'returning';

/** What the table asks the game layer about a card before offering the drop. */
export interface DropCheck {
  ok: boolean;
  /** One short line shown under the card while it is over the zone. */
  hint: string | null;
}

interface DragState {
  phase: DragPhase;
  instanceId: InstanceId | null;
  /** Card data for the ghost. Held here so the layer needs no view access. */
  card: CardData | null;
  faceIndex: number;
  /** Ghost size in px — the hand's card size, so nothing resizes as you lift it. */
  w: number;
  h: number;
  /** Ghost top-left, viewport px. */
  x: number;
  y: number;
  /** Is the pointer inside the drop zone right now? */
  over: boolean;
  /** May this card be dropped there? Decided once, when the drag begins. */
  ok: boolean;
  hint: string | null;

  begin: (drag: {
    instanceId: InstanceId;
    card: CardData | null;
    faceIndex: number;
    w: number;
    h: number;
    x: number;
    y: number;
    ok: boolean;
    hint: string | null;
  }) => void;
  move: (x: number, y: number, over: boolean) => void;
  /** Let go over the zone. The ghost stays put; the game layer decides what next. */
  release: () => void;
  /** Send the ghost back to its slot. The layer animates it and then resets. */
  returnHome: () => void;
  reset: () => void;
}

export const useDrag = create<DragState>((set, get) => ({
  phase: 'idle',
  instanceId: null,
  card: null,
  faceIndex: 0,
  w: 0,
  h: 0,
  x: 0,
  y: 0,
  over: false,
  ok: false,
  hint: null,

  begin: (drag) => set({ ...drag, phase: 'dragging', over: false }),

  move: (x, y, over) => {
    if (get().phase !== 'dragging') return;
    set({ x, y, over });
  },

  release: () => {
    if (get().phase !== 'dragging') return;
    set({ phase: 'released', over: false });
  },

  returnHome: () => {
    const phase = get().phase;
    if (phase === 'idle' || phase === 'returning') return;
    set({ phase: 'returning', over: false });
  },

  reset: () =>
    set({
      phase: 'idle',
      instanceId: null,
      card: null,
      faceIndex: 0,
      w: 0,
      h: 0,
      x: 0,
      y: 0,
      over: false,
      ok: false,
      hint: null,
    }),
}));

/** The id whose fan slot must paint nothing, because the ghost is holding it. */
export function heldInstanceId(): InstanceId | null {
  const s = useDrag.getState();
  return s.phase === 'idle' ? null : s.instanceId;
}
