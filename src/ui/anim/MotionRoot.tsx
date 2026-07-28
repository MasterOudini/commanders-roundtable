import { MotionConfig } from 'motion/react';
import type { ReactNode } from 'react';
import { EASE, ds, DUR } from './tokens';

// One MotionConfig at the root, so every declarative `motion.*` element in the
// app inherits the same default transition and the same reduced-motion policy.
//
// `reducedMotion="user"` makes motion honour the OS `prefers-reduced-motion`
// setting for DECLARATIVE animations — it drops transform and layout animations
// and keeps opacity and colour. It does NOT reach the imperative flight layer
// (that code calls `animate()` directly), so the choreographer checks the same
// preference itself and routes to digest mode. Both paths, one preference.
//
// ⚠️ On the `nonce` prop, which the spec calls for: motion injects a <style>
// element for some features, and a hardened CSP that omits 'unsafe-inline' from
// style-src would block it. Our CSP (electron/window.cjs `cspFor`) currently
// includes "style-src 'self' 'unsafe-inline'", so no nonce is required today and
// there is no nonce to read — index.html has none, and inventing one here would
// be a value the CSP header never declared, which is strictly worse than
// omitting it. If style-src is ever tightened, add a nonce to BOTH the CSP header
// and here in the same change; the probe asserts zero CSP console entries under
// the production posture, which is what would catch a mismatch.

export function MotionRoot({ children }: { children: ReactNode }) {
  return (
    <MotionConfig
      reducedMotion="user"
      transition={{ duration: ds(DUR.tap), ease: EASE.out }}
    >
      {children}
    </MotionConfig>
  );
}
