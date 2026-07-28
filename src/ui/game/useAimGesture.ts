import { useEffect } from 'react';
import { useAim } from '../../store/aimStore';
import { onVeilPick } from './aimCommit';
import { AIM_SLOP_PX, hitTest } from '../anim/arrowGeometry';

// The aiming gesture: one state machine, two entry points.
//
//                  click a spell / ability
//        idle ──────────────────────────────────► aiming (viaDrag: false)
//         ▲                                          │  arrow follows the free cursor
//         │                                          │  click a legal anchor → commit
//         │      press + drag on a veil button       │
//         └───◄── aiming (viaDrag: true) ◄───────────┘
//                  arrow follows the held pointer
//                  pointerup on a legal anchor → commit
//
// `viaDrag` decides only whether `pointerup` commits, which is what makes "both
// gestures must work" a boolean rather than a second implementation.
//
// ⚠️ Built on `useHandDrag`'s skeleton, and for its reasons: WINDOW listeners
// rather than pointer capture (the veil's buttons are re-created whenever the
// anchors are re-measured, and capture on an element that changes under you drops
// the gesture), every value in a closure rather than React state, and one
// measurement per gesture rather than one per move.
//
// ⚠️ THE MOVE HANDLER READS NO RECTS. Hit-testing is arithmetic over the frozen
// anchor snapshot the veil already took. That is what keeps the perf gate's stray
// rect reads at zero while the cursor moves.

export function useAimGesture(): void {
  useEffect(() => {
    const controller = new AbortController();
    const { signal } = controller;

    const move = (e: PointerEvent): void => {
      const s = useAim.getState();
      if (s.phase !== 'aiming') return;
      const legal = s.anchors.filter((a) => a.legal);
      const snap = hitTest({ x: e.clientX, y: e.clientY }, legal, AIM_SLOP_PX);
      s.moveTo(e.clientX, e.clientY, snap as never);
    };

    const up = (e: PointerEvent): void => {
      const s = useAim.getState();
      if (s.phase !== 'aiming' || !s.viaDrag) return;
      const legal = s.anchors.filter((a) => a.legal);
      const snap = hitTest({ x: e.clientX, y: e.clientY }, legal, AIM_SLOP_PX);
      if (!snap) return;
      commit(snap);
    };

    // A window that loses focus mid-aim must not leave an arrow glued to a
    // cursor that has gone away.
    const cancel = (): void => {
      const s = useAim.getState();
      if (s.phase === 'aiming' && s.viaDrag) s.moveTo(s.x, s.y, null);
    };

    window.addEventListener('pointermove', move, { signal });
    window.addEventListener('pointerup', up, { signal });
    window.addEventListener('blur', cancel, { signal });
    return () => controller.abort();
  }, []);
}

/** Releasing a drag on a legal anchor does exactly what clicking it would. */
function commit(key: string): void {
  const choice = choiceForKey(key);
  if (choice) onVeilPick(choice);
}

function choiceForKey(key: string): { kind: 'card' | 'player' | 'stack'; id: string } | null {
  if (key.startsWith('card:')) return { kind: 'card', id: key.slice(5) };
  if (key.startsWith('plate:')) return { kind: 'player', id: key.slice(6) };
  if (key.startsWith('stackitem:')) return { kind: 'stack', id: key.slice(10) };
  return null;
}
