import { useSyncExternalStore } from 'react';
import { isBusy, subscribeBusy } from '../anim/choreographer';
import { prefersReducedMotion, subscribeReducedMotion } from '../anim/reducedMotion';
import { useSettings } from '../../store/settingsStore';

// "Hold Space to speed up · Esc to skip."
//
// ⚠️ Both keys were wired in M2 (`App.tsx`) and were undiscoverable for three
// milestones. A feature nobody is told about has not shipped, and this is the
// ship milestone — so the last thing the skip wiring owed was somebody being
// able to find it.
//
// ⚠️ It appears ONLY while the choreographer actually has work. A permanently
// visible hint becomes furniture within a minute and stops being read, and it
// would sit on top of the table during every quiet turn for no reason. Bound to
// the one condition that makes it true, it is instead read exactly once — during
// the first big burst, which is precisely when a player wants it.
//
// ⚠️ And it hides itself when there is nothing to skip: with reduced motion on,
// or animation speed Off, the choreographer is in digest mode and there are no
// card flights to hurry. Offering to speed up something that is already instant
// is the kind of small lie that makes a whole interface feel untrustworthy.

const WRAP =
  'pointer-events-none absolute bottom-2 left-1/2 z-[955] -translate-x-1/2 rounded-full ' +
  'border border-crt-border bg-crt-surface/85 px-3 py-1 text-[11px] text-crt-faint ' +
  'transition-opacity duration-200';
const KEY = 'crt-num rounded border border-crt-border-hi bg-crt-raised px-1 text-crt-dim';

export function SkipHint() {
  const busy = useSyncExternalStore(subscribeBusy, isBusy, () => false);
  const reduced = useSyncExternalStore(subscribeReducedMotion, prefersReducedMotion, () => false);
  const speed = useSettings((s) => s.settings.animationSpeed);

  // Nothing is flying, so there is nothing to hurry along.
  if (reduced || speed === 'off') return null;

  return (
    <div
      className={WRAP}
      style={{ opacity: busy ? 1 : 0 }}
      aria-hidden
      data-skip-hint={busy ? 'visible' : 'hidden'}
    >
      Hold <span className={KEY}>Space</span> to speed up · <span className={KEY}>Esc</span> to skip
    </div>
  );
}
