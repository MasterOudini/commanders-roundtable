import { useEffect, useRef } from 'react';
import { Card } from '../card/Card';
import { cardSlot, resolveKey } from '../anim/rectRegistry';
import { prefersReducedMotion } from '../anim/reducedMotion';
import { useDrag } from '../../store/dragStore';

// The card you are holding. One fixed-position ghost above the whole app.
//
// ⚠️ Mounted at the APP root next to FlightOverlay, never inside the table. A
// `position: fixed` element is positioned against the viewport only while no
// ancestor has a transform, filter or backdrop-filter — any one of those makes
// that ancestor the containing block instead, and the card would then drift by
// the table's offset. Living beside the flight layer makes that impossible
// rather than merely true today.
//
// ⚠️ The position is written IMPERATIVELY from a store subscription, not through
// React state. A pointermove fires at the display's refresh rate; committing a
// React render per move on a 4-player board is exactly the work the perf gate
// counts as long frames. One transform write per move costs nothing and is the
// same thing the flight layer does with its MotionValues.

/**
 * How long the ghost takes to fly back to the fan when a drop is refused.
 *
 * ⚠️ NOT through `d()`, and that is deliberate: `d()` reads the choreographer's
 * scale gate, which belongs to the group it is currently building (D16). This is
 * an input affordance, like the hand fan's 90/60 ms hover intent, and it is timed
 * in its own right. Reduced motion is honoured as a MODE — no slide at all —
 * which is what `reducedMotion.ts` is for.
 */
const RETURN_MS = 190;

export function DragLayer() {
  const phase = useDrag((s) => s.phase);
  const instanceId = useDrag((s) => s.instanceId);
  const card = useDrag((s) => s.card);
  const faceIndex = useDrag((s) => s.faceIndex);
  const h = useDrag((s) => s.h);
  const over = useDrag((s) => s.over);
  const ok = useDrag((s) => s.ok);
  const hint = useDrag((s) => s.hint);
  const ref = useRef<HTMLDivElement | null>(null);

  // Follow the pointer. Subscribing rather than selecting is the point: this
  // effect runs on every move and re-renders nothing.
  useEffect(() => {
    const write = (x: number, y: number): void => {
      const el = ref.current;
      if (el) el.style.transform = `translate3d(${x}px, ${y}px, 0)`;
    };
    const s = useDrag.getState();
    if (s.phase !== 'idle') write(s.x, s.y);
    return useDrag.subscribe((next) => {
      // ⚠️ Only while dragging. During `returning` the stored x/y are still the
      // drop point, and an unrelated store write would yank the ghost back to it
      // mid-flight — a jump that looks like the return animation misfiring.
      if (next.phase === 'dragging') write(next.x, next.y);
    });
  }, []);

  // The return flight: to the card's own slot in the fan, which is still mounted
  // (hidden) and therefore still measurable. `resolveKey` never fails, so a slot
  // that has genuinely gone away lands the ghost in the middle of the table and
  // fades it out there rather than leaving it stuck at the pointer.
  useEffect(() => {
    if (phase !== 'returning') return;
    const ms = prefersReducedMotion() ? 0 : RETURN_MS;
    const el = ref.current;
    const home = instanceId ? resolveKey(cardSlot(instanceId)) : null;
    if (el && home && ms > 0) {
      // Card size comes from the store, never from `offsetWidth` — measuring the
      // ghost here would force a layout flush for a number we already have.
      const { w, h: gh } = useDrag.getState();
      el.style.transition = `transform ${ms}ms var(--crt-ease-out), opacity ${ms}ms linear`;
      el.style.opacity = '0';
      el.style.transform = `translate3d(${home.left + home.width / 2 - w / 2}px, ${
        home.top + home.height / 2 - gh / 2
      }px, 0)`;
    }
    const timer = window.setTimeout(() => useDrag.getState().reset(), ms + 20);
    return () => window.clearTimeout(timer);
  }, [phase, instanceId]);

  if (phase === 'idle' || !instanceId) return null;

  const lit = over && ok;
  const refused = over && !ok;

  return (
    <div
      // pointer-events: none throughout. The gesture is driven by window
      // listeners, and a ghost under the cursor that swallowed events would also
      // break `elementFromPoint` for anything else that ever needs it.
      className="pointer-events-none fixed left-0 top-0"
      style={{ zIndex: 930 }}
      data-drag-layer=""
      data-drag-phase={phase}
      data-drag-instance={instanceId}
      data-drag-over={over ? '1' : undefined}
      ref={ref}
    >
      <div
        style={{
          // Lifted off the table: a shade larger, with a shadow deep enough to
          // read as being above the fan rather than merely in front of it.
          transform: phase === 'dragging' ? 'scale(1.06)' : 'scale(1)',
          transition: prefersReducedMotion() ? undefined : 'transform 120ms var(--crt-ease-out)',
          filter: lit
            ? 'drop-shadow(0 22px 26px oklch(0 0 0 / 0.6)) drop-shadow(0 0 10px var(--color-crt-accent))'
            : 'drop-shadow(0 22px 26px oklch(0 0 0 / 0.6))',
          opacity: refused ? 0.7 : 1,
        }}
      >
        <Card
          card={card}
          height={h}
          faceIndex={faceIndex}
          // ⚠️ NOT the real slot. Registering here would overwrite the fan card's
          // entry in the rect registry, and every flight aimed at that card would
          // then aim at a ghost that no longer exists.
          registerSlot={false}
        />
      </div>

      {over && hint && (
        <div
          className="crt-num absolute left-1/2 top-full mt-1.5 -translate-x-1/2 whitespace-nowrap rounded px-1.5 py-0.5 text-[11px]"
          style={{
            background: 'oklch(0.16 0.01 260 / 0.94)',
            color: ok ? 'var(--color-crt-accent-hi)' : 'var(--color-crt-warn)',
            boxShadow: `inset 0 0 0 1px ${ok ? 'var(--color-crt-accent-lo)' : 'var(--color-crt-border)'}`,
          }}
          data-drag-hint=""
        >
          {hint}
        </div>
      )}
    </div>
  );
}
