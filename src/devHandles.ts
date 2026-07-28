// Dev-only probe handles.
//
// Verification in this workspace drives the REAL renderer over CDP
// (`npx electron . --dev --remote-debugging-port=9223` → Runtime.evaluate).
//
// ⚠️ A probe must never `await import('/src/…')` to reach a store. After any
// HMR pass the app's modules resolve as `file.ts?t=<stamp>` while a plain
// import loads a SECOND copy — so the probe reads a ghost zustand store,
// asserts against it, and every assertion lies. That cost two full false-
// failure runs in this workspace. Exposing the live instances here is the fix.
//
// Also: restart the Vite dev server after an edit session before probing, and
// launch with --disable-backgrounding-occluded-windows
// --disable-renderer-backgrounding (an occluded window freezes rAF and
// throttles timers, which reads exactly like a code regression).

type Handles = Record<string, unknown>;

/** Merge handles onto window.__crt. Safe to call from several modules. */
export function exposeDevHandles(handles: Handles): void {
  if (!import.meta.env.DEV) return;
  const w = window as unknown as { __crt?: Handles };
  w.__crt = { ...(w.__crt ?? {}), ...handles };
}

/**
 * Is eval() actually blocked by CSP?
 *
 * ⚠️ This MUST be computed by bundled app code, not by a probe expression.
 * Anything the debugger evaluates — including a <script> the debugger creates —
 * bypasses page CSP, so a probe that calls eval() itself reports "allowed" even
 * when the page's real CSP forbids it. That discrepancy (blocked under a
 * headless file:// load, "allowed" under --remote-debugging-port with the very
 * same CSP header) is a debugger artifact, not a hole. Reading this flag is how
 * a CDP probe gets the truth.
 */
function measureEvalBlocked(): boolean {
  try {
    // eslint-disable-next-line no-eval
    (0, eval)('1+1');
    return false;
  } catch {
    return true;
  }
}

/** Security facts measured from inside the bundle, exposed for CDP probes. */
export function exposeCspCanary(): void {
  exposeDevHandles({
    csp: {
      evalBlocked: measureEvalBlocked(),
      functionCtorBlocked: (() => {
        try {
          new Function('return 1')();
          return false;
        } catch {
          return true;
        }
      })(),
    },
  });
}
