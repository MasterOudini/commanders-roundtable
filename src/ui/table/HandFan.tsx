import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'motion/react';
import { Card } from '../card/Card';
import { register, zoneSlot } from '../anim/rectRegistry';
import { SPRING } from '../anim/tokens';
import {
  FAN_TRANSFORM_ORIGIN,
  fanGeometry,
  handCardPose,
} from './fanGeometry';
import { useAnim } from '../../store/animStore';
import { useDrag, type DropCheck } from '../../store/dragStore';
import { useHandHover } from '../../store/handStore';
import { useHandDrag } from './useHandDrag';
import type { FrozenRect } from '../anim/rectRegistry';
import type { InstanceId, PlayerView } from '../../view/types';
import { zoneCards, zoneId } from '../../view/types';

// My hand: the one place cards overlap, absolutely positioned with computed
// x / rotate / y.
//
// ⚠️ HOVER INTENT, 90 ms in and 60 ms out. Without the delays, sweeping the mouse
// across a 7-card hand fires seven open-and-close cycles and the whole fan
// strobes. Asymmetric on purpose: opening late feels responsive because the lift
// itself is fast, while closing late is what stops a 2 px wobble at a card's edge
// from dropping the card you are reading.
//
// ⚠️ The hovered index lives in a STORE, not in component state. That is what lets
// the battery assert the parting geometry by injecting a hover — synthetic pointer
// events are unusable here, because if the real mouse happens to be over the
// Electron window, genuine and synthetic pointermoves interleave and corrupt the
// gesture (a documented trap in this workspace). Store-injected state has no such
// failure mode and tests the same code path.
//
// A card also LEAVES the hand from here, by being dragged onto the table. The
// gesture lives in `useHandDrag`; what a drop MEANS is a callback from above, so
// this file still knows nothing about rules or an engine.

export function HandFan({
  view,
  cardH,
  cardW,
  bandWidth,
  bandHeight,
  pitchCap,
  onCardClick,
  onCardDrop,
  dropCheck,
}: {
  view: PlayerView;
  cardH: number;
  cardW: number;
  bandWidth: number;
  bandHeight: number;
  pitchCap: number;
  onCardClick?: (instanceId: string) => void;
  /** Released over the drop zone, at this rect. No handler → the hand does not drag. */
  onCardDrop?: (instanceId: InstanceId, rect: FrozenRect) => void;
  dropCheck?: (instanceId: InstanceId) => DropCheck;
}) {
  const inFlight = useAnim((s) => s.inFlight);
  const hovered = useHandHover((s) => s.hovered);
  const setHovered = useHandHover((s) => s.setHovered);
  // The card being held: its slot keeps its box but paints nothing, so the fan
  // does not re-flow around a gap that is about to be filled again.
  const held = useDrag((s) => (s.phase === 'idle' ? null : s.instanceId));
  const [zoomIndex, setZoomIndex] = useState<number | null>(null);

  const ids = zoneCards(view, zoneId('hand', view.me));
  const geometry = useMemo(
    () => fanGeometry({ count: ids.length, bandWidth, cardW, pitchCap }),
    [ids.length, bandWidth, cardW, pitchCap],
  );

  // Hover-intent timers. One pair of refs, cleared on unmount — never a timer per
  // card, which is how you end up with 30 pending timeouts after a mouse sweep.
  const openTimer = useRef<number | null>(null);
  const closeTimer = useRef<number | null>(null);
  const zoomTimer = useRef<number | null>(null);

  const clearTimers = useCallback(() => {
    for (const ref of [openTimer, closeTimer, zoomTimer]) {
      if (ref.current !== null) window.clearTimeout(ref.current);
      ref.current = null;
    }
  }, []);

  useEffect(() => clearTimers, [clearTimers]);

  const enter = useCallback(
    (index: number) => {
      // Dragging a card back across the fan must not re-arm the lift and zoom of
      // whatever it passes over.
      if (useDrag.getState().phase !== 'idle') return;
      if (closeTimer.current !== null) {
        window.clearTimeout(closeTimer.current);
        closeTimer.current = null;
      }
      if (openTimer.current !== null) window.clearTimeout(openTimer.current);
      openTimer.current = window.setTimeout(() => {
        openTimer.current = null;
        setHovered(index);
        // The zoom panel needs a longer, separate dwell: lifting a card is a cheap
        // signal you were looking at it, but covering a third of the table with a
        // 620 px preview needs you to have meant it.
        if (zoomTimer.current !== null) window.clearTimeout(zoomTimer.current);
        zoomTimer.current = window.setTimeout(() => {
          zoomTimer.current = null;
          setZoomIndex(index);
        }, 180);
      }, 90);
    },
    [setHovered],
  );

  const leave = useCallback(() => {
    if (openTimer.current !== null) {
      window.clearTimeout(openTimer.current);
      openTimer.current = null;
    }
    if (zoomTimer.current !== null) {
      window.clearTimeout(zoomTimer.current);
      zoomTimer.current = null;
    }
    if (closeTimer.current !== null) window.clearTimeout(closeTimer.current);
    closeTimer.current = window.setTimeout(() => {
      closeTimer.current = null;
      setHovered(null);
      setZoomIndex(null);
    }, 60);
  }, [setHovered]);

  // ⚠️ A drag must take the fan out of its hover state at once, not on the
  // 60 ms close delay. Otherwise the 620 px zoom panel opens over the table you
  // are dragging across, having been armed by the pointer that started the drag.
  const onDragStart = useCallback(() => {
    clearTimers();
    setHovered(null);
    setZoomIndex(null);
  }, [clearTimers, setHovered]);

  const drag = useHandDrag({
    cardW,
    cardH,
    onDragStart,
    ...(onCardDrop ? { onCardDrop } : {}),
    ...(dropCheck ? { dropCheck } : {}),
  });

  // A click that is really the tail of a drag plays the card twice — once by
  // being dropped, once by being clicked. Swallow it.
  const click = useCallback(
    (id: string) => {
      if (drag.suppressClick()) return;
      onCardClick?.(id);
    },
    [drag, onCardClick],
  );

  // 1–9 select a hand slot, which is also how the fan is reachable without a mouse.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const n = Number(e.key);
      if (!Number.isInteger(n) || n < 1 || n > 9) return;
      const index = n - 1;
      if (index >= ids.length) return;
      setHovered(index);
      const id = ids[index];
      if (id && onCardClick) onCardClick(id);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [ids, onCardClick, setHovered]);

  const zoomedId = zoomIndex !== null ? ids[zoomIndex] : undefined;
  const zoomedCard = zoomedId ? view.cards[zoomedId]?.card : null;

  return (
    <div
      className="relative"
      style={{ width: bandWidth, height: bandHeight }}
      data-hand-count={ids.length}
      data-hand-mode={geometry.mode}
      data-hand-hovered={hovered ?? undefined}
    >
      {/* The hand zone anchor: where a discard flies FROM when no specific card
          slot is registered, and where an opponent's draw lands. */}
      <div
        ref={(el) => register(zoneSlot(zoneId('hand', view.me)), el)}
        data-zone={zoneId('hand', view.me)}
        className="absolute"
        style={{ left: bandWidth / 2 - cardW / 2, top: 0, width: cardW, height: cardH }}
      />

      {geometry.mode === 'list' ? (
        // Past 32 cards the fan overflows even at minimum pitch. Commander really
        // does produce 30-card hands, so this is a specified mode, not a fallback.
        <div className="flex h-full items-start gap-1 overflow-x-auto pb-1">
          {ids.map((id) => {
            const c = view.cards[id];
            if (!c) return null;
            return (
              <div
                key={id}
                className="shrink-0"
                style={{ cursor: onCardDrop ? 'grab' : undefined }}
                onPointerDown={(e) =>
                  drag.onPointerDown(e, { instanceId: id, card: c.card, faceIndex: c.faceIndex })
                }
              >
                <Card
                  card={c.card}
                  height={96}
                  instanceId={id}
                  faceIndex={c.faceIndex}
                  inFlight={inFlight.has(id) || held === id}
                  {...(onCardClick ? { onClick: () => click(id) } : {})}
                />
              </div>
            );
          })}
        </div>
      ) : (
        geometry.slots.map((slot) => {
          const id = ids[slot.index];
          if (!id) return null;
          const c = view.cards[id];
          if (!c) return null;
          const pose = handCardPose(slot, hovered);
          return (
            <motion.div
              key={id}
              className="absolute top-0"
              style={{
                width: cardW,
                height: cardH,
                transformOrigin: FAN_TRANSFORM_ORIGIN,
                zIndex: pose.z,
              }}
              animate={{ x: pose.x, y: pose.y, rotate: pose.rotate, scale: pose.scale }}
              transition={hovered === slot.index ? SPRING.lift : SPRING.fan}
              onPointerEnter={() => enter(slot.index)}
              onPointerLeave={leave}
              onPointerDown={(e) =>
                drag.onPointerDown(e, { instanceId: id, card: c.card, faceIndex: c.faceIndex })
              }
              data-hand-slot={slot.index}
              data-hand-instance={id}
            >
              <div
                style={{
                  // The lifted card gets a real drop shadow so it reads as being
                  // above the others rather than just larger.
                  filter:
                    hovered === slot.index
                      ? 'drop-shadow(0 18px 24px oklch(0 0 0 / 0.55))'
                      : undefined,
                  cursor: onCardDrop ? 'grab' : undefined,
                }}
              >
                <Card
                  card={c.card}
                  height={cardH}
                  instanceId={id}
                  faceIndex={c.faceIndex}
                  inFlight={inFlight.has(id) || held === id}
                  {...(onCardClick ? { onClick: () => click(id) } : {})}
                />
              </div>
            </motion.div>
          );
        })
      )}

      {zoomedCard && (
        <div
          className="pointer-events-none absolute bottom-full left-1/2 z-[940] mb-2 -translate-x-1/2"
          data-hand-zoom={zoomedId}
          style={{ animation: 'crt-scale-in 140ms var(--crt-ease-out)' }}
        >
          <Card card={zoomedCard} height={Math.round(cardH * 1.6)} registerSlot={false} />
        </div>
      )}
    </div>
  );
}
