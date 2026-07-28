import { useCallback, useEffect, useRef } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import { readElements, type FrozenRect } from '../anim/rectRegistry';
import { useDrag, type DropCheck } from '../../store/dragStore';
import type { CardData } from '../../data/cardTypes';
import type { InstanceId } from '../../view/types';

// Dragging a card out of the hand. The GESTURE only — this file has no idea what
// dropping a card means, which is the M2↔M3 seam holding: `src/ui/table/` knows
// there is a drop zone and a callback, and nothing about rules, casting or the
// engine. In fixture mode no callback is passed and the hand simply does not drag.

/** Movement before a press becomes a drag. Below this it is still a click. */
const DRAG_THRESHOLD_PX = 6;
/** A click fired this soon after a drag ended belongs to the drag, not the card. */
const CLICK_SUPPRESS_MS = 250;

/** The one drop zone: my own side of the table. Marked by `PlayerPod`. */
export const DROP_ZONE_SELECTOR = '[data-drop-zone="bf"]';

export interface HandDragOptions {
  /** Hand card size, so the ghost is exactly the card you picked up. */
  cardW: number;
  cardH: number;
  /** Called on release inside the zone. The rect is where the card was let go. */
  onCardDrop?: (instanceId: InstanceId, rect: FrozenRect) => void;
  /** May this card be dropped there, and what should the ghost say? */
  dropCheck?: (instanceId: InstanceId) => DropCheck;
  /** Called when a drag begins, so the fan can drop its hover and zoom. */
  onDragStart?: () => void;
}

export interface HandDragHandlers {
  onPointerDown: (
    e: ReactPointerEvent,
    card: { instanceId: InstanceId; card: CardData | null; faceIndex: number },
  ) => void;
  /** True while a drag is ending, so the click it produces can be swallowed. */
  suppressClick: () => boolean;
}

export function useHandDrag(opts: HandDragOptions): HandDragHandlers {
  const { cardW, cardH, onCardDrop, dropCheck, onDragStart } = opts;

  // Everything the gesture needs lives in refs. A drag spans many events and no
  // renders; putting any of it in state would re-render the whole fan per move.
  const pressRef = useRef<{
    id: InstanceId;
    card: CardData | null;
    faceIndex: number;
    startX: number;
    startY: number;
    pointerId: number;
    dragging: boolean;
  } | null>(null);
  const zoneRef = useRef<FrozenRect | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const endedAtRef = useRef(0);

  // A drag interrupted by an unmount (screen change, game ended) must not leave
  // its listeners — or a held card — behind.
  useEffect(
    () => () => {
      abortRef.current?.abort();
      if (useDrag.getState().phase !== 'idle') useDrag.getState().reset();
    },
    [],
  );

  const finish = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    pressRef.current = null;
    zoneRef.current = null;
  }, []);

  const onPointerDown = useCallback(
    (
      e: ReactPointerEvent,
      card: { instanceId: InstanceId; card: CardData | null; faceIndex: number },
    ) => {
      // Left button only, and only when someone upstream can act on a drop.
      if (!onCardDrop || e.button !== 0) return;
      if (useDrag.getState().phase !== 'idle') return;

      abortRef.current?.abort();
      const ac = new AbortController();
      abortRef.current = ac;
      pressRef.current = {
        id: card.instanceId,
        card: card.card,
        faceIndex: card.faceIndex,
        startX: e.clientX,
        startY: e.clientY,
        pointerId: e.pointerId,
        dragging: false,
      };

      // ⚠️ WINDOW listeners, not pointer capture on the card. The card's element
      // is hidden the moment the drag begins and can be re-keyed by a re-fan
      // underneath it; capture on an element that changes under you drops the
      // rest of the gesture, and the card sticks to the cursor forever.
      const onMove = (ev: PointerEvent): void => {
        const press = pressRef.current;
        if (!press || ev.pointerId !== press.pointerId) return;

        if (!press.dragging) {
          const dx = ev.clientX - press.startX;
          const dy = ev.clientY - press.startY;
          if (Math.hypot(dx, dy) < DRAG_THRESHOLD_PX) return;
          press.dragging = true;
          onDragStart?.();
          // ⚠️ ONE rect read for the whole drag. The drop zone cannot move while
          // a card is held — nothing relayouts the table mid-gesture — so reading
          // it per move would be a forced layout flush per frame for a number
          // that never changes.
          const [zone] = readElements([document.querySelector(DROP_ZONE_SELECTOR)]);
          zoneRef.current = zone ?? null;
          const check = dropCheck?.(press.id) ?? { ok: false, hint: null };
          useDrag.getState().begin({
            instanceId: press.id,
            card: press.card,
            faceIndex: press.faceIndex,
            w: cardW,
            h: cardH,
            ...ghostAt(ev.clientX, ev.clientY, cardW, cardH),
            ok: check.ok,
            hint: check.hint,
          });
        }

        const pos = ghostAt(ev.clientX, ev.clientY, cardW, cardH);
        useDrag.getState().move(pos.x, pos.y, inside(zoneRef.current, ev.clientX, ev.clientY));
      };

      const onUp = (ev: PointerEvent): void => {
        const press = pressRef.current;
        if (!press || ev.pointerId !== press.pointerId) return;
        if (!press.dragging) {
          // A press that never moved: leave it entirely to the click handler.
          finish();
          return;
        }
        endedAtRef.current = performance.now();
        const state = useDrag.getState();
        const dropped = state.over;
        const rect: FrozenRect = { left: state.x, top: state.y, width: state.w, height: state.h };
        const id = press.id;
        finish();
        if (dropped) {
          // Park the ghost where it was let go and hand the decision upstairs.
          // Whoever takes it either submits — and the flight starts from this
          // very rect — or sends the card home with `returnHome`.
          state.release();
          onCardDrop(id, rect);
        } else {
          state.returnHome();
        }
      };

      const onCancel = (): void => {
        if (pressRef.current?.dragging) {
          endedAtRef.current = performance.now();
          useDrag.getState().returnHome();
        }
        finish();
      };

      window.addEventListener('pointermove', onMove, { signal: ac.signal });
      window.addEventListener('pointerup', onUp, { signal: ac.signal });
      window.addEventListener('pointercancel', onCancel, { signal: ac.signal });
      // Losing the window mid-drag (alt-tab, a dialog stealing focus) ends the
      // gesture rather than leaving a card glued to a cursor that has gone away.
      window.addEventListener('blur', onCancel, { signal: ac.signal });
    },
    [cardH, cardW, dropCheck, finish, onCardDrop, onDragStart],
  );

  const suppressClick = useCallback(
    () => performance.now() - endedAtRef.current < CLICK_SUPPRESS_MS,
    [],
  );

  return { onPointerDown, suppressClick };
}

/**
 * Where the ghost sits for a pointer at (x, y).
 *
 * Centred horizontally and held at 38% of its height, which is roughly where a
 * thumb holds a card and — more usefully — keeps the name and cost above the
 * cursor rather than under it.
 */
function ghostAt(x: number, y: number, w: number, h: number): { x: number; y: number } {
  return { x: Math.round(x - w / 2), y: Math.round(y - h * 0.38) };
}

function inside(rect: FrozenRect | null, x: number, y: number): boolean {
  if (!rect) return false;
  return (
    x >= rect.left && x <= rect.left + rect.width && y >= rect.top && y <= rect.top + rect.height
  );
}
