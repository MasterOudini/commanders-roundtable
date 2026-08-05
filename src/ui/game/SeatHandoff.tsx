import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { prefersReducedMotion, subscribeReducedMotion } from '../anim/reducedMotion';
import { useTable } from '../../store/tableStore';
import * as session from '../../game/session';

// "You are Ana now."
//
// ⚠️ Solo play is a HOTSEAT (D42): the table follows whoever the game is waiting
// on, and until this it did so SILENTLY. Played by hand, that reads as the app
// changing sides on its own — you play a land as Ben, the board is suddenly
// Ana's, and the only evidence is which button in the seat picker is outlined.
// Reported in exactly those words: "it changes the side… that was Ben's turn,
// but I'm not Ben right now."
//
// ⚠️ It announces the hand-offs the GAME made, never one the player made. The
// signal comes from `session.onSeatHandoff`, which fires inside the automatic
// switch alone — a banner over a seat button somebody just pressed explains
// nothing they did not just do.
//
// ⚠️ Green, because green is PRIORITY (D99) and that is what a hand-off is
// about. Brass would say "whose turn", which the phase bar already answers and
// which a hand-off frequently does NOT change: most of them move the table to a
// seat that is only responding.

const WRAP =
  'pointer-events-none absolute left-1/2 top-1/2 z-[958] -translate-x-1/2 -translate-y-1/2 ' +
  'rounded-lg border border-crt-border bg-crt-surface/90 px-5 py-3 text-center shadow-xl ' +
  'backdrop-saturate-150';

/** Long enough to read two short lines, short enough never to be in the way. */
const DWELL_MS = 2200;
const FADE_MS = 260;

export function SeatHandoff() {
  const seats = useTable((s) => s.seats);
  const reduced = useSyncExternalStore(subscribeReducedMotion, prefersReducedMotion, () => false);
  const [handoff, setHandoff] = useState<session.SeatHandoff | null>(null);
  const [visible, setVisible] = useState(false);
  // ⚠️ Both timers live in a ref and are cleared on every new hand-off. Two
  // switches inside one dwell is ordinary — a blocker prompt followed by the
  // attacker's response window — and without this the first one's fade-out
  // would hide the second one's banner halfway through reading it.
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => {
    const clear = (): void => {
      for (const t of timers.current) clearTimeout(t);
      timers.current = [];
    };
    const unsub = session.onSeatHandoff((next) => {
      clear();
      setHandoff(next);
      setVisible(true);
      timers.current.push(
        setTimeout(() => setVisible(false), DWELL_MS),
        setTimeout(() => setHandoff(null), DWELL_MS + FADE_MS),
      );
    });
    return () => {
      clear();
      unsub();
    };
  }, []);

  if (!handoff) return null;

  const nameOf = (id: string): string => seats.find((s) => s.id === id)?.name ?? id;

  return (
    <div
      className={WRAP}
      style={{
        opacity: visible ? 1 : 0,
        transition: reduced ? undefined : `opacity ${FADE_MS}ms var(--crt-ease-out)`,
      }}
      aria-live="polite"
      data-seat-handoff={visible ? 'visible' : 'hiding'}
      data-handoff-to={handoff.to}
    >
      <p className="font-sc text-xs tracking-wider text-crt-faint">
        {nameOf(handoff.from)} <span className="text-crt-dim">→</span>{' '}
        <span className="text-crt-ok">{nameOf(handoff.to)}</span>
      </p>
      <p className="mt-0.5 text-sm text-crt-text">You are {nameOf(handoff.to)} now</p>
    </div>
  );
}
