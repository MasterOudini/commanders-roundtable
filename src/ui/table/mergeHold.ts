import { useEffect, useRef, useState } from 'react';
import { DUR } from '../anim/tokens';
import type { PackItem } from './packRow';
import type { InstanceId } from '../../view/types';

// Holding an auto-stack MERGE open until the cards inside it have straightened.
//
// ⚠️ THE PROBLEM THIS EXISTS FOR. Tap state is part of the auto-stacking key
// (D19) — five tapped Forests are a different pile from the seven untapped ones,
// because "how many can I still tap" is decision-relevant. So untapping them does
// not move a card: it RE-GROUPS. The turned pile stops existing, its slot
// unmounts, and the quarter turn everybody just asked for never plays. There is
// nothing on screen to animate, which is why no amount of easing fixed it.
//
// So the grouping — and only the grouping — lags the view by one turn. For those
// 180 ms the two piles are still drawn, their cards straighten in place (the
// Card reads tap state from the VIEW, which is already current), and only then do
// they become one pile. The row's own re-flow is delayed by the same duration for
// the same reason (see `BattlefieldBand`), so the merge and the row closing up
// land together rather than as two separate lurches.
//
// ⚠️ WHAT IS HELD IS A DISPLAY DECISION, NOT STATE. Zone membership, tap state and
// counters all keep coming straight from the view; a held grouping only says
// "draw these cards as two stacks rather than one", which is the same question the
// auto-stack toggle answers. It also self-heals: any change to WHICH cards are in
// the band drops the hold on the spot.

/**
 * Piles in `prev` that `next` has absorbed into another pile — and that were
 * TAPPED, so a turn is owed to them.
 *
 * A pile whose top card is in neither list left the battlefield entirely: that is
 * a flight's job, and holding a slot open for it would leave a ghost racing the
 * clone.
 */
export function mergedAwayPiles(
  prev: readonly PackItem[],
  next: readonly PackItem[],
): InstanceId[] {
  const stillOwnSlot = new Set(next.map((i) => i.instanceId));
  const absorbedInto = new Map<InstanceId, PackItem>();
  for (const item of next) for (const id of item.members) absorbedInto.set(id, item);

  const out: InstanceId[] = [];
  for (const item of prev) {
    if (!item.tapped) continue;
    if (stillOwnSlot.has(item.instanceId)) continue;
    if (!absorbedInto.has(item.instanceId)) continue;
    out.push(item.instanceId);
  }
  return out;
}

/** The same cards, however they are grouped? The guard on holding anything. */
export function sameCards(a: readonly PackItem[], b: readonly PackItem[]): boolean {
  const ids = (items: readonly PackItem[]) =>
    items
      .flatMap((i) => i.members)
      .slice()
      .sort()
      .join(',');
  return ids(a) === ids(b);
}

/**
 * Re-read tap state from the live view onto a held grouping.
 *
 * ⚠️ This is what makes the hold safe to look at: the SHAPE is stale by design,
 * every fact inside it is current. A held pile whose cards have untapped reports
 * itself untapped, so it takes an upright footprint and the row starts closing on
 * the same frame the turn starts — the grouping is the only thing waiting.
 */
export function refreshTapState(
  items: readonly PackItem[],
  isTapped: (id: InstanceId) => boolean,
): PackItem[] {
  return items.map((item) => {
    const untapped = item.members.filter((id) => !isTapped(id)).length;
    return { ...item, untapped, tapped: item.members.length > 0 && untapped === 0 };
  });
}

/**
 * The grouping to draw this frame: the live one, or the one from just before a
 * merge, for as long as the cards inside it are still turning.
 */
export function useMergeHold(
  live: PackItem[],
  isTapped: (id: InstanceId) => boolean,
): PackItem[] {
  const [held, setHeld] = useState<PackItem[] | null>(null);
  const prevLive = useRef<PackItem[]>(live);

  let items = live;
  if (held) {
    // ⚠️ Dropped the moment the band's cards change. A hold is only ever about
    // regrouping the SAME cards; anything else — a permanent entering, a creature
    // dying mid-turn — makes the held shape a lie rather than a lag.
    if (sameCards(held, live)) items = refreshTapState(held, isTapped);
    else setHeld(null);
  } else if (
    mergedAwayPiles(prevLive.current, live).length > 0 &&
    sameCards(prevLive.current, live)
  ) {
    // Adjusting state during render, deliberately: the alternative is an effect,
    // which runs AFTER the frame that already dropped the pile — one frame of the
    // merged board, which is exactly the pop being fixed.
    setHeld(prevLive.current);
    items = refreshTapState(prevLive.current, isTapped);
  }
  prevLive.current = live;

  useEffect(() => {
    if (!held) return;
    const timer = window.setTimeout(() => setHeld(null), DUR.tap);
    return () => window.clearTimeout(timer);
  }, [held]);

  return items;
}
