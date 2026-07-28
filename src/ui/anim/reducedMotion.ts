// `prefers-reduced-motion` — read in exactly ONE place.
//
// ⚠️ ONE READER, for the same reason `governor.ts` has one `effectiveMode`. Two
// call sites of `matchMedia('(prefers-reduced-motion: reduce)')` are two chances
// to spell the query differently, to forget the `.matches`, or — the one that
// actually bites — to disagree about what happens in a non-DOM context. The
// choreographer decides the animation MODE from this; the settings screen tells
// the user their OS has overridden their choice. Those two must never disagree,
// or the screen says "Cinematic" while the table plays nothing and the setting
// reads as broken.
//
// ⚠️ THIS IS A MODE INPUT, NOT A SCALE INPUT. D16 fixes the effective animation
// scale as the product of exactly three things — the user's speed setting, the
// governor's backpressure rate, and hold-to-fast-forward — and `d(ms)` reads it
// from the choreographer alone. Reduced motion does not make beats *faster*; it
// routes the choreographer to DIGEST, where there are no flying clones to scale.
// Adding it as a fourth multiplier would silently double-apply with speed 'off'
// (Infinity × anything) and is exactly the fourth reader D16 forbids.
//
// ⚠️ DIGEST IS NOT PAUSE. The choreographer keeps consuming events and
// committing state; it only stops flying clones. A paused choreographer diverges
// from the log, and after M4 that means diverging from three other people.

const QUERY = '(prefers-reduced-motion: reduce)';

function mediaQueryList(): MediaQueryList | null {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return null;
  try {
    return window.matchMedia(QUERY);
  } catch {
    // A DOM without media-query support is a DOM that cannot have expressed a
    // preference. Defaulting to `false` keeps full motion, which is the state
    // every other code path already assumes.
    return null;
  }
}

/** True when the OS asks for reduced motion. False everywhere it cannot be known. */
export function prefersReducedMotion(): boolean {
  return mediaQueryList()?.matches ?? false;
}

/**
 * Subscribe to changes. Returns an unsubscribe closure.
 *
 * ⚠️ Deliberately NOT a React hook, and deliberately not importing React: this
 * module is imported by `choreographer.ts`, which is plain TS with no React by
 * design (the flight layer and animStore are reached as module singletons).
 * `useSyncExternalStore(subscribeReducedMotion, prefersReducedMotion)` is the
 * whole React binding, and it lives at the call site.
 */
export function subscribeReducedMotion(onChange: () => void): () => void {
  const mql = mediaQueryList();
  if (!mql) return () => undefined;
  // Safari < 14 and some embedded WebViews only have the deprecated form. The
  // fallback costs two lines and is the difference between "the setting updates
  // live" and "the setting updates when you restart the app".
  if (typeof mql.addEventListener === 'function') {
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }
  mql.addListener(onChange);
  return () => mql.removeListener(onChange);
}
