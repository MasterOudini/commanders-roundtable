import { useEffect, useRef, useSyncExternalStore } from 'react';
import { useAim } from '../../store/aimStore';
import { useTable } from '../../store/tableStore';
import { useGame } from '../../store/gameStore';
import {
  AIM_ARC,
  aimControl,
  centerOf,
  edgePoint,
  fanOffset,
  headAngle,
  quadPath,
  type Pt,
} from '../anim/arrowGeometry';
import { prefersReducedMotion, subscribeReducedMotion } from '../anim/reducedMotion';
import { readAll, resolveKey, stackItemSlot, type FrozenRect, type SlotKey } from '../anim/rectRegistry';

// The targeting arrow — MTG Arena's, and the first SVG in this renderer.
//
// ⚠️ MOUNTED AT THE APP ROOT, beside DragLayer, for three independent reasons and
// not just the usual one. (a) A `position: fixed` element loses the viewport as
// its containing block under any transformed or filtered ancestor. (b) Stronger
// and already in the code: `PlayerPod` sets `contain: layout paint`, which
// establishes a containing block for fixed descendants AND clips them — an arrow
// drawn inside a pod would be positioned against that pod and scissored at its
// edge. (c) An arrow's whole job is to cross between pods, so anything with
// `overflow` or `contain` between it and the viewport is a clip waiting to happen.
//
// ⚠️ SVG, not Canvas2D. The decisive reason is that it is DIRECTLY ASSERTABLE:
// `querySelector('[data-aim-arrow]').getAttribute('d')` returns exactly the path
// that was painted, so the battery measures the arrow rather than a store value
// that ought to equal it. A canvas would also mean inheriting DPR handling, a
// resize observer and a rAF loop to save nothing — `FxCanvas` exists because 1200
// particles in the DOM is absurd; eight paths on a canvas is the opposite mistake.
//
// ⚠️ REFUSAL IS SIGNALLED BY SHAPE, NEVER COLOUR — a dashed stroke when the
// cursor is over nothing legal. `--color-crt-warn` and `--color-crt-accent` are
// 4° apart in hue, so a warn-coloured arrow reads as "a slightly different yes",
// and red on this table already means damage. Same rule `PlayerPod`'s dashed
// refusal border follows. The five MTG colours appear nowhere in this file.

/** Between the FX canvas (920) and the held card (930): above the burst, under the card you are steering. */
const ARROW_Z = 925;

const HEAD = 'M 0 0 L -13 -6.5 L -9.5 0 L -13 6.5 Z';

function viewport(): { w: number; h: number } {
  // ⚠️ `innerWidth` is not a `getBoundingClientRect` and does not trip the perf
  // monkeypatch, but it CAN force layout, so it is read on resize and cached —
  // never per pointermove.
  return { w: window.innerWidth, h: window.innerHeight };
}

export function ArrowLayer() {
  const phase = useAim((s) => s.phase);
  const anchorEpoch = useAim((s) => s.anchorEpoch);
  const mode = useTable((s) => s.mode);
  const stack = useGame((s) => s.view.stack);
  const reduced = useSyncExternalStore(subscribeReducedMotion, prefersReducedMotion, () => false);

  const pathRef = useRef<SVGPathElement | null>(null);
  const haloRef = useRef<SVGPathElement | null>(null);
  const headRef = useRef<SVGPathElement | null>(null);
  const vpRef = useRef(typeof window === 'undefined' ? { w: 0, h: 0 } : viewport());

  useEffect(() => {
    const onResize = (): void => {
      vpRef.current = viewport();
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // ⚠️ The live arrow is written IMPERATIVELY from a store subscription. A
  // pointermove fires at the display's refresh rate; a React commit per move on a
  // 4-player board is exactly what the perf gate counts as long frames. Six
  // `setAttribute` calls cost nothing, and — the part that matters — this reads
  // ZERO rects, because every anchor was measured once when the aim began.
  useEffect(() => {
    const write = (): void => {
      const s = useAim.getState();
      const path = pathRef.current;
      const halo = haloRef.current;
      const head = headRef.current;
      if (!path || !halo || !head || s.phase !== 'aiming' || !s.sourceRect) return;

      const from = centerOf(s.sourceRect);
      const snapped = s.snapKey ? s.anchors.find((a) => a.key === s.snapKey) : undefined;
      const to: Pt = snapped ? edgePoint(snapped.rect, from) : { x: s.x, y: s.y };
      const ctrl = aimControl(from, to, AIM_ARC, vpRef.current);
      const d = quadPath(from, ctrl, to);

      halo.setAttribute('d', d);
      path.setAttribute('d', d);
      // Shape, not colour: dashed means "there is nothing here to hit".
      if (snapped) path.removeAttribute('stroke-dasharray');
      else path.setAttribute('stroke-dasharray', '5 5');
      path.setAttribute('stroke-width', snapped ? '3.5' : '3');
      path.setAttribute('stroke', snapped ? 'var(--color-crt-accent-hi)' : 'var(--color-crt-accent)');
      path.setAttribute('opacity', snapped ? '1' : '0.55');
      head.setAttribute('transform', `translate(${to.x} ${to.y}) rotate(${headAngle(from, ctrl, to)})`);
      head.setAttribute('opacity', snapped ? '1' : '0.4');
    };
    write();
    return useAim.subscribe(write);
  }, [phase]);

  // Committed arrows, DERIVED from `mode.chosen` rather than stored twice — which
  // is why `escape()` popping a target removes its arrow with no bookkeeping.
  const committed: { key: string; d: string; tip: Pt }[] = [];
  if (phase === 'aiming' && mode.kind === 'targeting') {
    const src = useAim.getState().sourceRect;
    if (src) {
      const from = centerOf(src);
      mode.chosen.forEach((choice, i) => {
        const rect = rectForChoice(choice);
        if (!rect) return;
        const to = edgePoint(rect, from);
        const base = aimControl(from, to, AIM_ARC, vpRef.current);
        const off = fanOffset(i, mode.chosen.length);
        const ctrl = { x: base.x + off * 0.35, y: base.y + off * 0.35 };
        committed.push({ key: `${choice.kind}:${choice.id}`, d: quadPath(from, ctrl, to), tip: to });
      });
    }
  }

  // Blocks already declared: blocker → the attacker it is stopping.
  //
  // ⚠️ Distinguished from a TARGET arrow by SHAPE — a perpendicular parry bar
  // across the head — not by colour. Same rule as the dashed refusal: hue is
  // already carrying the five MTG colours and the damage red, and an arrow that
  // means something different has to survive being looked at quickly.
  //
  // ⚠️ Derived from `mode.blocks`, so `escape()` popping one removes its arrow.
  const blocks: { key: string; d: string; tip: Pt; angle: number }[] = [];
  if (mode.kind === 'blockers') {
    const byAttacker = new Map<string, number>();
    for (const b of mode.blocks) byAttacker.set(b.attacker, (byAttacker.get(b.attacker) ?? 0) + 1);
    const seen = new Map<string, number>();
    for (const b of mode.blocks) {
      const fromRect = resolveKey(`card:${b.blocker}`);
      const toRect = resolveKey(`card:${b.attacker}`);
      const from = centerOf(fromRect);
      const to = edgePoint(toRect, from);
      // Several blockers on one attacker fan apart, the same way their poses will.
      const i = seen.get(b.attacker) ?? 0;
      seen.set(b.attacker, i + 1);
      const off = fanOffset(i, byAttacker.get(b.attacker) ?? 1);
      const base = aimControl(from, to, AIM_ARC, vpRef.current);
      const ctrl = { x: base.x + off * 0.35, y: base.y + off * 0.35 };
      blocks.push({
        key: `${b.blocker}>${b.attacker}`,
        d: quadPath(from, ctrl, to),
        tip: to,
        angle: headAngle(from, ctrl, to),
      });
    }
  }

  // Persistent arrows: what is already on the stack, aimed at what.
  //
  // ⚠️ Only the TOP TWO items, which is the spec's own rule — at four players a
  // full stack's arrows become spaghetti and stop meaning anything.
  const persistent: { key: string; d: string }[] = [];
  const top = stack.slice(-2);
  for (const item of top) {
    const fromRect = resolveKey(stackItemSlot(item.stackItemId));
    const from = centerOf(fromRect);
    item.targets.forEach((t, i) => {
      const rect = rectForChoice(t);
      if (!rect) return;
      const to = edgePoint(rect, from);
      const base = aimControl(from, to, AIM_ARC, vpRef.current);
      const off = fanOffset(i, item.targets.length);
      persistent.push({
        key: `${item.stackItemId}:${i}`,
        d: quadPath(from, { x: base.x + off * 0.35, y: base.y + off * 0.35 }, to),
      });
    });
  }

  const aiming = phase === 'aiming';
  if (!aiming && persistent.length === 0 && blocks.length === 0) return null;

  return (
    <svg
      className="pointer-events-none fixed inset-0 h-full w-full"
      style={{ zIndex: ARROW_Z }}
      data-arrow-layer=""
      data-arrow-epoch={anchorEpoch}
      aria-hidden
    >
      {/* Already on the stack. Dimmed hard while aiming — the live arrow has to
          be unmistakable. */}
      {persistent.map((p) => (
        <path
          key={p.key}
          d={p.d}
          data-stack-arrow=""
          fill="none"
          stroke="var(--color-crt-accent-lo)"
          strokeWidth={1.5}
          strokeDasharray="4 6"
          strokeLinecap="round"
          opacity={aiming ? 0.18 : 0.45}
          className={reduced ? undefined : 'crt-arrow-march'}
        />
      ))}

      {committed.map((c) => (
        <g key={c.key} data-committed-arrow={c.key}>
          <path d={c.d} fill="none" stroke="var(--color-crt-accent)" strokeWidth={2} strokeLinecap="round" />
          <circle cx={c.tip.x} cy={c.tip.y} r={3} fill="var(--color-crt-accent)" />
        </g>
      ))}

      {/* A declared block. The PARRY BAR across the head is what says "this one
          stops that one" rather than "this one targets that one". */}
      {blocks.map((b) => (
        <g key={b.key} data-block-arrow={b.key}>
          <path d={b.d} fill="none" stroke="var(--color-crt-accent)" strokeWidth={2.5} strokeLinecap="round" />
          <g transform={`translate(${b.tip.x} ${b.tip.y}) rotate(${b.angle})`}>
            <path d={HEAD} fill="var(--color-crt-accent)" />
            <line x1={-9} y1={-9} x2={-9} y2={9} stroke="var(--color-crt-accent-hi)" strokeWidth={2.5} strokeLinecap="round" />
          </g>
        </g>
      ))}

      {aiming && (
        <>
          <path ref={haloRef} fill="none" stroke="var(--color-crt-accent-lo)" strokeWidth={6} strokeLinecap="round" opacity={0.35} />
          <path ref={pathRef} data-aim-arrow="" fill="none" strokeWidth={3} strokeLinecap="round" />
          <path ref={headRef} data-aim-head="" d={HEAD} fill="var(--color-crt-accent-hi)" />
        </>
      )}
    </svg>
  );
}

/**
 * The on-screen rect a chosen target stands for.
 *
 * ⚠️ Reads through `rectRegistry`, which holds the app's monopoly on
 * `getBoundingClientRect`, and `resolveKey` never fails — so a target that has
 * left the screen lands its arrow in the middle of the table rather than
 * throwing or drawing to NaN.
 */
function rectForChoice(choice: { kind: string; id: string }): FrozenRect | null {
  const key = keyForChoice(choice);
  return key ? resolveKey(key) : null;
}

function keyForChoice(choice: { kind: string; id: string }): SlotKey | null {
  if (choice.kind === 'card') return `card:${choice.id}`;
  if (choice.kind === 'player') return `plate:${choice.id}`;
  if (choice.kind === 'stack') return `stackitem:${choice.id}`;
  return null;
}

export { readAll };
