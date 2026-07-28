// The felt. Four stacked CSS layers, zero image assets.
//
//   1. the base colour
//   2. a vignette, so the middle of the table is where your eye goes
//   3. a static SVG turbulence noise, at 3.5% over an overlay blend — this is what
//      stops a large flat area of one OKLCH colour looking like a filled rectangle
//   4. an inlay ring, so the four pods have something to sit AROUND
//
// All static, so the compositor draws it once and never again. ⚠️ Nothing here may
// animate: it covers the whole viewport, so a single animated property on this
// element repaints the entire table every frame and eats most of the 16.6 ms
// budget by itself.
//
// The colour is a deep desaturated blue-green precisely so the five highly
// saturated MTG colours read cleanly on top of it, and the accent is brass —
// deliberately NOT one of the five — so an accent ring can never be misread as
// "this card has red mana".

/** 64×64 feTurbulence, inlined as a data URI. No file, no request, no CSP concern. */
const NOISE =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='64' height='64'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='64' height='64' filter='url(%23n)' opacity='0.5'/%3E%3C/svg%3E\")";

export function TableSurface() {
  return (
    <div aria-hidden className="absolute inset-0 overflow-hidden" data-table-surface="">
      <div className="absolute inset-0" style={{ background: 'var(--color-crt-table)' }} />
      <div
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(120% 90% at 50% 42%, transparent, oklch(0.13 0.014 250 / 0.55))',
        }}
      />
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: NOISE,
          backgroundRepeat: 'repeat',
          opacity: 0.035,
          mixBlendMode: 'overlay',
        }}
      />
      <div
        className="pointer-events-none absolute rounded-[28px]"
        style={{
          inset: '6% 4%',
          border: '1px solid var(--color-crt-border)',
          boxShadow: 'inset 0 0 60px oklch(0.13 0.014 250 / 0.35)',
        }}
      />
    </div>
  );
}
