import { useEffect, useRef } from 'react';
import { attachFx, type BurstSpec, type FxSink, type RingSpec } from './fxBus';
import { FX_Z } from '../flightLayer';

// The particle layer. Canvas2D + requestAnimationFrame.
//
// ⚠️ NOT WEBGL, and not by default — by measurement. 1200 additive 4–10 px sprites
// at 1920×1080 on an RTX 3060, with Chromium's GPU-rasterized canvas, is nowhere
// near a bottleneck. WebGL would add a second GPU context, a shader compile and a
// separate memory pool, all competing with the compositor for the same GPU, in
// exchange for nothing perceptible. Reassess only if screen-space distortion
// (heat shimmer) ever comes into scope — which it explicitly does not.
//
// ⚠️ THIS CANVAS NEVER DRAWS A GLYPH. Every piece of floating FX text is DOM
// (FxOverlay). That is what makes this workspace's tofu rule STRUCTURAL rather
// than a discipline: there is no `document.fonts.load()` race that can bake a
// missing-glyph box into a texture, because there is no text in any texture. Do
// not add `ctx.fillText` here — put the text in FxOverlay instead.
//
// ⚠️ THE LOOP PARKS ITSELF. `cancelAnimationFrame` when nothing is alive, restart
// on the first emit. A canvas rAF that never sleeps is a permanent ~3% CPU tax on
// a game that is idle most of the time — the player spends far more of a Commander
// game reading than watching particles.
//
// ⚠️ devicePixelRatio is RE-READ ON EVERY RESIZE, not captured once. Windows
// display scaling of 1.25 or 1.5 is common and can change at runtime (moving the
// window to another monitor). Caching it once gives a canvas that is silently half
// resolution or twice the memory after a monitor change.

/** Pool size. 8 × Float32Array(1200) = 38.4 KB, preallocated once. */
const MAX = 1200;

interface Pool {
  x: Float32Array;
  y: Float32Array;
  vx: Float32Array;
  vy: Float32Array;
  /** Remaining life, ms. <= 0 means the slot is free. */
  life: Float32Array;
  /** Initial life, for the alpha ramp. */
  life0: Float32Array;
  size: Float32Array;
  hue: Float32Array;
  gravity: Float32Array;
}

interface Ring {
  x: number;
  y: number;
  from: number;
  to: number;
  age: number;
  duration: number;
  hue: number;
}

function makePool(): Pool {
  return {
    x: new Float32Array(MAX),
    y: new Float32Array(MAX),
    vx: new Float32Array(MAX),
    vy: new Float32Array(MAX),
    life: new Float32Array(MAX),
    life0: new Float32Array(MAX),
    size: new Float32Array(MAX),
    hue: new Float32Array(MAX),
    gravity: new Float32Array(MAX),
  };
}

export function FxCanvas() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { alpha: true, desynchronized: true });
    if (!ctx) return;

    const pool = makePool();
    /** Free-slot cursor. A ring buffer beats scanning for a hole every emit. */
    let cursor = 0;
    let rings: Ring[] = [];
    let raf: number | null = null;
    let last = 0;
    let dpr = 1;
    let cssW = 0;
    let cssH = 0;
    // ⚠️ Deterministic pseudo-random, seeded per mount. `Math.random()` would make
    // a recorded FX assertion irreproducible, and this file is the one place in the
    // renderer that wants a lot of jitter.
    let seed = 0x2f6e2b1;
    const rand = () => {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      return seed / 0x100000000;
    };
    const between = (lo: number, hi: number) => lo + (hi - lo) * rand();

    function resize() {
      const rect = canvas!.getBoundingClientRect();
      cssW = Math.max(1, Math.round(rect.width));
      cssH = Math.max(1, Math.round(rect.height));
      // Re-read, never cached — see the note at the top of this file.
      dpr = window.devicePixelRatio || 1;
      canvas!.width = Math.round(cssW * dpr);
      canvas!.height = Math.round(cssH * dpr);
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    function step(now: number) {
      const dt = last === 0 ? 16 : Math.min(48, now - last);
      last = now;

      ctx!.clearRect(0, 0, cssW, cssH);

      // ONE additive pass for every particle. No per-particle save/restore: that
      // is the difference between one composite and 1200 state changes.
      ctx!.globalCompositeOperation = 'lighter';
      let alive = 0;
      for (let i = 0; i < MAX; i++) {
        if (pool.life[i]! <= 0) continue;
        pool.life[i]! -= dt;
        if (pool.life[i]! <= 0) {
          pool.life[i] = 0;
          continue;
        }
        alive++;
        const s = dt / 1000;
        pool.vy[i]! += pool.gravity[i]! * s;
        pool.x[i]! += pool.vx[i]! * s;
        pool.y[i]! += pool.vy[i]! * s;

        const t = pool.life[i]! / pool.life0[i]!;
        ctx!.globalAlpha = t * t;
        ctx!.fillStyle = `oklch(0.82 0.19 ${pool.hue[i]})`;
        const r = pool.size[i]!;
        ctx!.beginPath();
        ctx!.arc(pool.x[i]!, pool.y[i]!, r, 0, Math.PI * 2);
        ctx!.fill();
      }

      if (rings.length > 0) {
        ctx!.globalCompositeOperation = 'lighter';
        rings = rings.filter((ring) => {
          ring.age += dt;
          const t = ring.age / ring.duration;
          if (t >= 1) return false;
          const radius = ring.from + (ring.to - ring.from) * t;
          ctx!.globalAlpha = 0.7 * (1 - t);
          ctx!.strokeStyle = `oklch(0.86 0.16 ${ring.hue})`;
          ctx!.lineWidth = 3 * (1 - t) + 0.5;
          ctx!.beginPath();
          ctx!.arc(ring.x, ring.y, radius, 0, Math.PI * 2);
          ctx!.stroke();
          return true;
        });
      }

      ctx!.globalAlpha = 1;
      ctx!.globalCompositeOperation = 'source-over';

      if (alive === 0 && rings.length === 0) {
        // Park. The next emit restarts the loop.
        raf = null;
        last = 0;
        ctx!.clearRect(0, 0, cssW, cssH);
        return;
      }
      raf = requestAnimationFrame(step);
    }

    function wake() {
      if (raf === null) {
        last = 0;
        raf = requestAnimationFrame(step);
      }
    }

    const sink: FxSink = {
      burst(spec: BurstSpec) {
        const n = Math.min(spec.count, MAX);
        for (let k = 0; k < n; k++) {
          // Ring-buffer allocation: overwrite the oldest slot rather than dropping
          // the emit. A cap that silently drops the NEWEST particles makes a big
          // burst look like a small one.
          const i = cursor;
          cursor = (cursor + 1) % MAX;
          const angle =
            spec.direction === undefined
              ? rand() * Math.PI * 2
              : spec.direction + (rand() - 0.5) * (spec.spread ?? Math.PI / 3);
          const speed = between(spec.speedMin, spec.speedMax);
          pool.x[i] = spec.x;
          pool.y[i] = spec.y;
          pool.vx[i] = Math.cos(angle) * speed;
          pool.vy[i] = Math.sin(angle) * speed;
          const life = between(spec.lifeMin, spec.lifeMax);
          pool.life[i] = life;
          pool.life0[i] = life;
          pool.size[i] = between(spec.sizeMin, spec.sizeMax);
          pool.hue[i] = spec.hue;
          pool.gravity[i] = spec.gravity ?? 0;
        }
        wake();
      },
      ring(spec: RingSpec) {
        rings.push({
          x: spec.x,
          y: spec.y,
          from: spec.fromRadius,
          to: spec.toRadius,
          age: 0,
          duration: Math.max(1, spec.durationMs),
          hue: spec.hue,
        });
        wake();
      },
      stats() {
        // ⚠️ COUNTED HERE, not read from the value `step()` maintains. `active` is
        // only refreshed inside the rAF loop, so a caller that emits and reads in
        // the same tick — which is exactly what a probe does — saw 0 active
        // particles immediately after emitting 4000. Counting 1200 slots is
        // nothing; reporting a stale 0 makes the pool cap unverifiable.
        let live = 0;
        for (let i = 0; i < MAX; i++) if (pool.life[i]! > 0) live++;
        return { active: live, rafHandle: raf, dpr, w: canvas.width, h: canvas.height };
      },
      clear() {
        pool.life.fill(0);
        rings = [];
      },
    };

    resize();
    attachFx(sink);

    let resizeFrame = 0;
    const onResize = () => {
      if (resizeFrame) return;
      resizeFrame = requestAnimationFrame(() => {
        resizeFrame = 0;
        resize();
      });
    };
    const ro = new ResizeObserver(onResize);
    ro.observe(canvas);
    window.addEventListener('resize', onResize);

    return () => {
      attachFx(null);
      if (raf !== null) cancelAnimationFrame(raf);
      if (resizeFrame) cancelAnimationFrame(resizeFrame);
      ro.disconnect();
      window.removeEventListener('resize', onResize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      data-fx-canvas=""
      className="pointer-events-none fixed inset-0 h-full w-full"
      style={{ zIndex: FX_Z }}
    />
  );
}

export { MAX as FX_MAX_PARTICLES };
