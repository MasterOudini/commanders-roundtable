import { useEffect } from 'react';
import { plateSlot, readElements, stackItemSlot, type SlotKey } from '../anim/rectRegistry';
import { useTable } from '../../store/tableStore';
import { useGame } from '../../store/gameStore';
import { useLayout } from '../../store/layoutStore';
import { useAim, type AimAnchor } from '../../store/aimStore';
import { AIM_SLOP_PX, hitTest } from '../anim/arrowGeometry';
import type { TargetChoice } from '../../engine/types/state';

// The aim veil: while a spell or ability is being targeted, ONLY legal targets
// are clickable.
//
// ⚠️ It works by covering the table and re-exposing the legal targets, not by
// disabling the illegal ones. Every card, plate and stack item on the table gets
// a positioned hit area here; a legal target's is `pointer-events: auto` and
// every other one is `pointer-events: none`. That is directly measurable
// (`getComputedStyle(el).pointerEvents` over `[data-aim-card]`), which is the
// point: "the UI only lets you click legal targets" is otherwise a claim nobody
// can check.
//
// ⚠️ THE HIT TEST IS THIS FROZEN RECT SWEEP, NOT `elementFromPoint`. Three
// reasons, and the second is the one that matters most: (a) `elementFromPoint`
// forces a hit test against current layout, which flushes style and layout if
// anything is dirty — once per pointermove; (b) it would be an UNMEASURED escape
// hatch, since `perf.ts` patches `getBoundingClientRect` only, so it would do the
// same damage while keeping the meter at zero; (c) while the veil is up it
// returns the veil anyway.
//
// ⚠️ Positions come from `rectRegistry.readElements`, the ONLY legal caller of
// `getBoundingClientRect` in this app, so the whole sweep is one layout flush
// with no interleaved writes.

/** The instance id a rendered card slot stands for, whichever zone it is in. */
export function instanceIdOf(el: Element | null): string | null {
  if (!el) return null;
  return el.getAttribute('data-band-slot') ?? el.getAttribute('data-hand-instance');
}

/**
 * The target a rendered anchor stands for, whatever kind it is.
 *
 * ⚠️ `data-card-id` is the SCRYFALL (printing) id, not the instance id — two
 * copies of Sol Ring share it. The instance id lives on the SLOT wrappers.
 * Reading the wrong one made the veil find no targets at all and report "0/0
 * legal", which reads as "there is nothing to target" rather than "the selector
 * is wrong" (D45). `data-pod` is a seat REGION, not a target anchor — it is the
 * coarse combat defender only.
 */
export function anchorOf(el: Element | null): { choice: TargetChoice; key: SlotKey } | null {
  if (!el) return null;
  const band = el.getAttribute('data-band-slot') ?? el.getAttribute('data-hand-instance');
  if (band) return { choice: { kind: 'card', id: band }, key: `card:${band}` };
  const plate = el.getAttribute('data-plate');
  if (plate) return { choice: { kind: 'player', id: plate }, key: plateSlot(plate) };
  const item = el.getAttribute('data-stack-item');
  if (item) return { choice: { kind: 'stack', id: item }, key: stackItemSlot(item) };
  return null;
}

const SELECTOR = '[data-band-slot], [data-hand-instance], [data-plate], [data-stack-item]';

function sameChoice(a: TargetChoice, b: TargetChoice): boolean {
  return a.kind === b.kind && a.id === b.id;
}

/**
 * ⚠️ The veil knows nothing about MODES. It is handed a legal set, the ids that
 * are already picked, and what a pick means — which is what lets one measurable
 * overlay serve both "aim a spell" and "choose a blocker", instead of two
 * overlays that drift apart on the day one of them gains a rule.
 */
export function AimVeil({
  active,
  legalTargets,
  chosenIds,
  onPick,
}: {
  active: boolean;
  legalTargets: readonly TargetChoice[];
  chosenIds: ReadonlySet<string>;
  onPick: (choice: TargetChoice) => void;
}) {
  const view = useGame((s) => s.view);
  // Re-measure when anything on the table MOVES, not on every commit.
  const metricsEpoch = useLayout((s) => s.metricsEpoch);
  const anchors = useAim((s) => s.anchors);
  const setAnchors = useAim((s) => s.setAnchors);
  const aiming = active;

  // ⚠️ Legality and geometry are computed in the SAME pass. They used to be
  // split — `GameLayer` recomputed the legal set on `[mode.kind]` while this
  // swept on `[…, view]` — so during an aim the veil re-measured on every view
  // commit and never re-legalised. A creature that died mid-aim kept its legal
  // ring, which at four players is entirely reachable.
  useEffect(() => {
    if (!aiming) {
      if (anchors.length > 0) setAnchors([]);
      return;
    }
    const els = [...document.querySelectorAll(SELECTOR)];
    const rects = readElements(els);
    const next: AimAnchor[] = [];
    for (const [i, el] of els.entries()) {
      const anchor = anchorOf(el);
      const rect = rects[i];
      if (!anchor || !rect || rect.width === 0) continue;
      next.push({
        key: anchor.key,
        rect,
        legal: legalTargets.some((t) => sameChoice(t, anchor.choice)),
      });
    }
    setAnchors(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aiming, legalTargets, metricsEpoch, view]);

  if (!aiming) return null;

  return (
    <div
      className="pointer-events-auto absolute inset-0 z-[900] bg-crt-void/45"
      data-aim-veil=""
      onClick={() => useTable.getState().escape()}
    >
      {anchors.map((hit) => {
        const choice = choiceForKey(hit.key);
        const isChosen = choice ? chosenIds.has(choice.id) : false;
        return (
          <button
            key={hit.key}
            type="button"
            data-aim-key={hit.key}
            data-aim-card={choice?.kind === 'card' ? choice.id : undefined}
            data-aim-legal={hit.legal ? '1' : '0'}
            aria-hidden={!hit.legal}
            tabIndex={hit.legal ? 0 : -1}
            // ⚠️ Inline, not a Tailwind class: the value is computed per element
            // and a runtime-composed class name is never emitted by Tailwind 4.
            //
            // ⚠️ The hover lift is `scale` ON THIS BUTTON, never on the card. A
            // Card root may carry no transform, filter or transition — that
            // element belongs to the animation beats (D76) — and a per-card prop
            // would also defeat Card's memo, which is worth a measured 50–58 ms
            // per commit on a 4-player board. Growing the overlay reads as the
            // card lifting and touches nothing.
            style={{
              position: 'absolute',
              left: hit.rect.left,
              top: hit.rect.top,
              width: hit.rect.width,
              height: hit.rect.height,
              pointerEvents: hit.legal ? 'auto' : 'none',
            }}
            className={
              hit.legal
                ? isChosen
                  ? 'rounded-[6px] outline outline-2 outline-crt-accent-hi'
                  : 'crt-aim-pulse rounded-[6px] outline outline-2 outline-crt-accent/70 transition-transform hover:scale-[1.06] hover:outline-crt-accent-hi'
                : ''
            }
            // ⚠️ The SWEEP uses the unscaled rect, so the hover lift is presentation
            // only and hit-testing can never disagree with what is drawn.
            onPointerDown={(e) => {
              if (!hit.legal || !choice) return;
              e.preventDefault();
              useAim.getState().moveTo(e.clientX, e.clientY, hit.key);
            }}
            onClick={(e) => {
              e.stopPropagation();
              if (!hit.legal || !choice) return;
              onPick(choice);
            }}
          />
        );
      })}
    </div>
  );
}

/** The inverse of `anchorOf`, for a key we already hold. */
function choiceForKey(key: SlotKey): TargetChoice | null {
  if (key.startsWith('card:')) return { kind: 'card', id: key.slice(5) };
  if (key.startsWith('plate:')) return { kind: 'player', id: key.slice(6) };
  if (key.startsWith('stackitem:')) return { kind: 'stack', id: key.slice(10) };
  return null;
}

export { hitTest, AIM_SLOP_PX };
