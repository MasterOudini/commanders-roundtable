import type { PointerEvent as ReactPointerEvent } from 'react';
import { useEffect, useMemo, useRef } from 'react';
import { PermanentStack } from './PermanentStack';
import { groupIdentical, packRow, sortByCluster } from './packRow';
import { useMergeHold } from './mergeHold';
import { prefersReducedMotion } from '../anim/reducedMotion';
import { DUR } from '../anim/tokens';
import { useAnim } from '../../store/animStore';
import { useLayout } from '../../store/layoutStore';
import type { BandKind, InstanceId, PlayerId, PlayerView } from '../../view/types';
import { bandFor, zoneCards, zoneId } from '../../view/types';

// One battlefield band. Two per seat:
//
//   • COMBAT band — creatures, planeswalkers, battles. Always the band NEAREST THE
//     MIDDLE of the table, mirrored for opponents (their creatures sit at the
//     bottom of their pod). That mirroring is what makes an attack read as
//     crossing the table rather than as cards sliding around a list.
//   • SUPPORT band — three left-to-right clusters with a gap between them: lands
//     (leftmost, most numerous, most stacked) → artifacts → enchantments.
//
// Auras and equipment are in NEITHER band. They tuck under their host in
// PermanentStack, because an Equipment in its own slot loses the only thing you
// need to know about it.

export function BattlefieldBand({
  view,
  player,
  band,
  cardH,
  cardW,
  width,
  height,
  gap,
  minCardH,
  autoStack = true,
  onCardClick,
  onCardPointerDown,
  onAttachmentsClick,
}: {
  view: PlayerView;
  player: PlayerId;
  band: BandKind;
  cardH: number;
  cardW: number;
  width: number;
  height: number;
  gap: number;
  minCardH: number;
  autoStack?: boolean;
  onCardClick?: (instanceId: InstanceId, e?: { shiftKey: boolean }, members?: readonly InstanceId[]) => void;
  /** Only MY bands take this: it is how an Equipment is picked up. */
  onCardPointerDown?: (instanceId: InstanceId, e: ReactPointerEvent) => void;
  /** EVERY band takes this — an opponent's auras are worth reading too. */
  onAttachmentsClick?: (host: InstanceId, x: number, y: number) => void;
}) {
  const rowSweeps = useAnim((s) => s.rowSweeps);
  const sweepKey = `${player}:${band}`;
  const sweep = rowSweeps[sweepKey];
  const sweeping = sweep !== undefined;
  /** Position of a card in the current sweep, or -1. Drives its transition delay. */
  const sweepIndexOf = (id: InstanceId) => sweep?.order.indexOf(id) ?? -1;

  const live = useMemo(() => {
    const ids = zoneCards(view, zoneId('bf', player));
    const attachmentsByHost = new Map<InstanceId, InstanceId[]>();
    for (const id of ids) {
      const c = view.cards[id];
      if (c?.attachedTo) {
        const list = attachmentsByHost.get(c.attachedTo) ?? [];
        list.push(id);
        attachmentsByHost.set(c.attachedTo, list);
      }
    }

    const inBand = ids
      .map((id) => view.cards[id])
      .filter((c) => !!c && !c.attachedTo && bandFor(c.card, c.faceIndex).band === band)
      .map((c) => c!);

    let items = groupIdentical(
      inBand,
      (id) => attachmentsByHost.get(id) ?? [],
      autoStack,
    );
    // Only the support band clusters; creatures are one continuous row.
    if (band === 'support') items = sortByCluster(items);
    return items;
  }, [view, player, band, autoStack]);

  // ⚠️ THE GROUPING LAGS THE VIEW BY ONE TURN when a merge would otherwise erase
  // a turned pile before it could straighten. Nothing else lags: every fact drawn
  // inside these items is read from the live view. See `mergeHold`.
  const items = useMergeHold(live, (id) => view.cards[id]?.tapped === true);

  const packed = useMemo(
    () =>
      packRow(items, {
        rowWidth: width,
        cardW,
        cardH,
        gap,
        minCardH,
        ...(band === 'support' ? { clusterGap: Math.round(gap * 2.5) } : {}),
      }),
    [items, band, width, cardW, cardH, gap, minCardH],
  );

  // ── When the row RE-FLOWS, relative to the turn ────────────────────────────
  //
  // A tap and an untap are the same event in two directions, and the row has to
  // read that way too:
  //
  //   tap   — the gap OPENS first, and the card turns into the room now waiting
  //           for it. Measured across a full sweep: never one pixel of overlap.
  //   untap — the card straightens FIRST, and only then does the row close up.
  //
  // Without the delay the second case is the first one played wrong: the slots
  // close while the cards are still lying flat, and a card overlaps its neighbour
  // by up to 37 px for ~350 ms — measured, and the one thing a battlefield row is
  // never allowed to do. Waiting is also simply what it looks like on a table: you
  // straighten your lands, then tidy them up.
  //
  // ⚠️ `DUR.tap` RAW, not through `d()`. The turn is a CSS transition on
  // `var(--crt-dur)`, which the choreographer's scale gate does not touch — so
  // scaling this delay would drift from the thing it is waiting for. Reduced
  // motion is the one case that must skip it: the stylesheet has already collapsed
  // every transition to 0.01 ms, so there is nothing left to wait for.
  const prevFootprint = useRef(new Map<InstanceId, number>());
  const closing = packed.cards.some((c) => {
    const was = prevFootprint.current.get(c.instanceId);
    return was !== undefined && was > c.footprintW;
  });
  useEffect(() => {
    const next = new Map<InstanceId, number>();
    for (const c of packed.cards) next.set(c.instanceId, c.footprintW);
    prevFootprint.current = next;
  });

  // A coalesced untap-all staggers by 34 ms per card, so the row must also wait
  // out the tail — the sweep is the one place that knows how long that is.
  const reflowDelayMs =
    closing && !prefersReducedMotion()
      ? DUR.tap + (sweep ? sweep.stepMs * Math.max(0, sweep.order.length - 1) : 0)
      : 0;

  // ── Which arrivals may turn on mount ───────────────────────────────────────
  //
  // A card that mounts tapped cannot animate its turn — a CSS transition has
  // nothing to move from on a first style — so `Card` can render it upright for
  // one frame first. That is right for a permanent entering the battlefield
  // tapped (Cultivate, every game) and for the new slot a pile makes when you tap
  // one copy of it. It is WRONG for a board that arrived all at once, where
  // twenty tapped cards would turn in unison for no reason.
  //
  // Two guards, each for a case that really happens:
  //
  //  • `hardSyncFlash` — the choreographer sets it for every wholesale board
  //    replacement: a rebuild, a reconnect snapshot, the start of a game. That is
  //    the precise signal, and it is already on screen as the resync fade.
  //  • this band had cards a render ago. A band whose component is brand new is a
  //    viewer switch or a first paint, where every slot is "new" and none of them
  //    arrived.
  const hardSync = useAnim((s) => s.hardSyncFlash);
  const bandWasPopulated = prevFootprint.current.size > 0;
  const arrivedAlone = (id: InstanceId) =>
    bandWasPopulated && !hardSync && !prevFootprint.current.has(id);

  // ⚠️ A RESIZE IS NOT A RE-PACK. Every card's column changes when the window
  // changes size, and sliding fifty of them across the table is both wrong — the
  // cards did not move, the table did — and slow, since it lands ~50 springs on
  // the frame that is already re-laying-out the whole screen. The metrics epoch
  // is the same signal the flight layer uses to snap clones rather than fly them
  // to a rect that has since moved.
  const metricsEpoch = useLayout((s) => s.metricsEpoch);
  const lastEpoch = useRef(metricsEpoch);
  const resized = lastEpoch.current !== metricsEpoch;
  useEffect(() => {
    lastEpoch.current = metricsEpoch;
  }, [metricsEpoch]);

  return (
    <div
      className="relative"
      style={{
        width,
        height,
        // `contain: layout paint` scopes this band's layout and paint work, so a
        // card animating in one pod cannot invalidate the layout of another.
        contain: 'layout paint',
        // A scrolling row is the fourth rung of the packing ladder; the honest
        // answer past that is the pod expander.
        overflowX: packed.scrolls ? 'auto' : 'visible',
        overflowY: 'visible',
        scrollSnapType: packed.scrolls ? 'x proximity' : undefined,
      }}
      data-band={`${player}:${band}`}
      data-band-cards={packed.cards.length}
      data-band-scale={packed.scale.toFixed(3)}
      data-band-scrolls={packed.scrolls ? '1' : undefined}
    >
      {/* The untap-all row sweep: one translating gradient across the whole row
          rather than a highlight per card, which would be 12 more animations. */}
      {sweeping && (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 z-10"
          style={{
            background:
              'linear-gradient(100deg, transparent 40%, oklch(0.86 0.13 80 / 0.18) 50%, transparent 60%)',
            backgroundSize: '260% 100%',
            animation: 'crt-shimmer 240ms var(--crt-ease-out) 1',
          }}
        />
      )}

      {packed.cards.map((p) => (
        <PermanentStack
          key={p.instanceId}
          view={view}
          packed={p}
          height={packed.cardH}
          tapDelayMs={
            sweep && sweepIndexOf(p.instanceId) >= 0
              ? sweepIndexOf(p.instanceId) * sweep.stepMs
              : 0
          }
          reflowDelayMs={reflowDelayMs}
          instantX={resized}
          turnOnMount={arrivedAlone(p.instanceId)}
          {...(onCardClick ? { onClick: onCardClick } : {})}
          {...(onCardPointerDown ? { onPointerDown: onCardPointerDown } : {})}
          {...(onAttachmentsClick ? { onAttachmentsClick } : {})}
        />
      ))}

      {packed.overflow > 0 && (
        <div className="crt-num pointer-events-none absolute right-0 top-0 z-20 rounded bg-crt-raised/95 px-1.5 py-0.5 text-[10px] text-crt-accent-hi ring-1 ring-crt-border">
          +{packed.overflow}
        </div>
      )}
    </div>
  );
}
