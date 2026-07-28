import { create } from 'zustand';
import type { FrozenRect, SlotKey } from '../ui/anim/rectRegistry';

// The live aim: where the arrow starts, where the cursor is, and what it snapped
// to. Modelled on `dragStore`, including its two invariants.
//
// ⚠️ THIS STORE HOLDS INTENTIONS, NEVER TRUTH. What is targetable, what is
// legal and what was finally chosen all live elsewhere — the chosen targets are
// `useTable`'s `mode.chosen`, and the arrow layer DERIVES the committed arrows
// from them. One source of truth means `escape()` popping a target removes its
// arrow with no second piece of bookkeeping to fall out of sync.
//
// ⚠️ NOTHING MAY SELECT `x`, `y` OR `snapKey`. They are written on every
// pointermove; a `useAim((s) => s.x)` anywhere would put a React commit on the
// mouse. They are reachable through `getState()` and `subscribe()` only, which
// is exactly the discipline `dragStore` uses and the reason a pointermove can
// write a zustand store at all.

export type AimPhase = 'idle' | 'aiming';

export interface AimAnchor {
  readonly key: SlotKey;
  readonly rect: FrozenRect;
  readonly legal: boolean;
}

interface AimState {
  phase: AimPhase;
  /** The rect the tail is pinned to — a card slot, or a dropped card's rect. */
  sourceKey: SlotKey | null;
  sourceRect: FrozenRect | null;
  /** Frozen anchor snapshot. Re-read on begin, on resize, and on view commit. */
  anchors: readonly AimAnchor[];
  /** ⚠️ LIVE CURSOR — written per pointermove. Do not select. */
  x: number;
  y: number;
  /** The anchor under the cursor, or null. Changes a few times a second. */
  snapKey: SlotKey | null;
  /** True when the gesture began as a press-drag, so pointerup commits. */
  viaDrag: boolean;
  /** Bumped whenever `anchors` is replaced, so the veil can re-render once. */
  anchorEpoch: number;

  begin: (a: { sourceKey: SlotKey | null; sourceRect: FrozenRect; viaDrag: boolean }) => void;
  setAnchors: (anchors: readonly AimAnchor[]) => void;
  /** The ONE writer per pointermove. */
  moveTo: (x: number, y: number, snapKey: SlotKey | null) => void;
  reset: () => void;
}

export const useAim = create<AimState>((set) => ({
  phase: 'idle',
  sourceKey: null,
  sourceRect: null,
  anchors: [],
  x: 0,
  y: 0,
  snapKey: null,
  viaDrag: false,
  anchorEpoch: 0,

  begin: ({ sourceKey, sourceRect, viaDrag }) =>
    set((s) => ({
      phase: 'aiming',
      sourceKey,
      sourceRect,
      viaDrag,
      snapKey: null,
      x: sourceRect.left + sourceRect.width / 2,
      y: sourceRect.top + sourceRect.height / 2,
      anchorEpoch: s.anchorEpoch + 1,
    })),

  setAnchors: (anchors) => set((s) => ({ anchors, anchorEpoch: s.anchorEpoch + 1 })),

  moveTo: (x, y, snapKey) => set({ x, y, snapKey }),

  reset: () =>
    set({ phase: 'idle', sourceKey: null, sourceRect: null, anchors: [], snapKey: null, viaDrag: false }),
}));
