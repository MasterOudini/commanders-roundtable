import { useEffect, useLayoutEffect, useRef } from 'react';
import { animate, useMotionValue, type AnimationPlaybackControls } from 'motion/react';
import { EASE, lifeCountMs, animScale } from '../anim/tokens';

// The life total. A MotionValue writing straight to the DOM, NOT React state.
//
// ⚠️ THIS IS THE KEY PERFORMANCE MOVE, and it is also the only way to get the
// behaviour right. Two reasons, and the second is the important one:
//
//   1. A life total counting 40 → 12 changes ~28 times. As React state that is 28
//      re-renders of the seat plate, its commander-damage matrix and its mana pool,
//      during a combat step that is already animating six other things.
//
//   2. RETARGETING. Damage in Commander arrives in bursts — 40 → 33 → 31 → 45 in
//      under a second is completely normal. Each new target must redirect the
//      COUNT IN PROGRESS, not restart it from 40. With React state you would
//      either queue the animations (so the number lags absurdly) or restart each
//      one (so the number visibly jumps back up to 40 between hits, which reads as
//      a bug). `animate(motionValue, next)` picks up from wherever the value
//      currently is. The battery asserts exactly this: monotone toward each
//      successive target, and NEVER back to 40.

export function LifeCounter({
  life,
  className = '',
  lethalWarning = true,
}: {
  life: number;
  className?: string;
  /** A 1.6 s breathing ring under 6 life. */
  lethalWarning?: boolean;
}) {
  const value = useMotionValue(life);
  const nodeRef = useRef<HTMLSpanElement | null>(null);
  const controlsRef = useRef<AnimationPlaybackControls | null>(null);
  const lastTarget = useRef(life);

  // Write the number by hand, so nothing about this counter re-renders React.
  //
  // ⚠️ useLayoutEffect, and the span below renders NO CHILDREN. Both matter.
  // Rendering `{life}` as children made React overwrite the text on every
  // re-render, so the moment a new target arrived the number JUMPED to it and then
  // snapped back to wherever the count actually was — during a 40→33→31→45 burst
  // the displayed value bounced non-monotonically and briefly showed 40 again after
  // it had already left. That is precisely the "restart, not retarget" artefact this
  // whole design exists to avoid, reintroduced by JSX. The layout effect (rather
  // than useEffect) means the first value is written before the browser paints, so
  // there is never a frame of empty text.
  useLayoutEffect(() => {
    const write = (v: number) => {
      const node = nodeRef.current;
      if (node) node.textContent = String(Math.round(v));
    };
    write(value.get());
    return value.on('change', write);
  }, [value]);

  useEffect(() => {
    if (lastTarget.current === life) return;
    const delta = life - value.get();
    lastTarget.current = life;

    // Stop rather than complete: `complete()` would snap to the OLD target first,
    // which is the visible jump this whole design exists to avoid.
    controlsRef.current?.stop();
    controlsRef.current = animate(value, life, {
      duration: lifeCountMs(delta) / 1000 / Math.max(1, animScale()),
      ease: EASE.out,
    });
  }, [life, value]);

  const low = lethalWarning && life <= 5;

  return (
    <span
      className={`crt-num relative inline-flex items-baseline ${className}`}
      data-life={life}
      // The number is announced from the game log, which carries the full
      // narrative; a live region on a counter that ticks 28 times would flood a
      // screen reader with intermediate values nobody asked for.
      aria-label={`${life} life`}
    >
      {/* No children: the layout effect above is the ONLY writer. See the note there. */}
      <span ref={nodeRef} aria-hidden />
      {low && (
        <span
          aria-hidden
          className="pointer-events-none absolute -inset-1 rounded"
          style={{
            boxShadow: '0 0 0 2px var(--color-crt-danger)',
            animation: 'crt-breathe 1600ms var(--crt-ease-in-out) infinite',
          }}
        />
      )}
    </span>
  );
}
