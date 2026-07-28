import type { PointerEvent as ReactPointerEvent } from 'react';
import { Card } from '../card/Card';
import { register, zoneSlot } from '../anim/rectRegistry';
import { useAnim } from '../../store/animStore';
import { useDrag } from '../../store/dragStore';
import type { CardData } from '../../data/cardTypes';
import type { InstanceId, PlayerId, PlayerView } from '../../view/types';
import { zoneCards, zoneId } from '../../view/types';

// The command zone: ONE SLOT PER COMMANDER, not a pile.
//
// ⚠️ Every other zone is a stack whose top card is the only one that matters. A
// command zone is not: a partner pair is two cards that are both always there,
// both castable, and the whole point is being able to see and reach EITHER. As a
// pile it drew one card with a "2" badge — and only the top one could be picked
// up, which is exactly the limitation D96 had to write down as a caveat.
//
// ⚠️ THE ZONE ANCHOR IS THE BOX, not a slot. `rectRegistry` resolves one anchor
// per zone and a flight lands on it; registering per commander would make the
// last one rendered win, so a card flying "to the command zone" would land on
// whichever slot happened to render second. The box is also the honest target:
// the zone is the box, the slots are what is in it.

export function CommandZone({
  view,
  player,
  height,
  onCardClick,
  onCardPointerDown,
}: {
  view: PlayerView;
  player: PlayerId;
  height: number;
  onCardClick?: (instanceId: InstanceId) => void;
  /**
   * Picking a commander up to cast it. Wired for my own zone only.
   *
   * ⚠️ Per COMMANDER now, not per zone — which is what makes a partner pair
   * fully reachable: either card can be dragged out, in any order.
   */
  onCardPointerDown?: (
    e: ReactPointerEvent,
    card: { instanceId: InstanceId; card: CardData | null; faceIndex: number },
  ) => void;
}) {
  const zone = zoneId('cmd', player);
  const ids = zoneCards(view, zone);
  const count = view.hiddenCounts[zone] ?? ids.length;
  const inFlight = useAnim((s) => s.inFlight);
  const heldId = useDrag((s) => (s.phase === 'idle' ? null : s.instanceId));
  const width = Math.round(height * (745 / 1040));

  // An empty zone still draws one slot: the anchor has to have a size, and a
  // commander that has just been cast has to have somewhere to come back to.
  const slots: (InstanceId | null)[] = ids.length > 0 ? ids : [null];

  return (
    // ⚠️ FULL WIDTH, which is what puts it on a row of its own: the pile block
    // wraps, and without this a two-commander box and the exile pile share the
    // top line and the order stops reading top-to-bottom.
    <div className="flex w-full shrink-0 flex-col items-center gap-1">
      <div
        // The anchor element, registered unconditionally — an empty command zone
        // is exactly the case a returning commander needs a target for.
        ref={(el) => register(zoneSlot(zone), el)}
        data-zone={zone}
        data-zone-count={count}
        className="flex items-center gap-1 rounded border border-crt-border/70 bg-crt-void/30 p-1"
        aria-label={`Command zone: ${count} card${count === 1 ? '' : 's'}`}
      >
        {slots.map((id, i) => {
          const inst = id ? view.cards[id] : undefined;
          const card = inst?.card ?? null;
          const hidden = !card;
          const held = !!id && heldId === id;
          return (
            <div
              key={id ?? `empty-${i}`}
              className={`relative ${onCardPointerDown && id && card ? 'cursor-grab active:cursor-grabbing' : ''}`}
              style={{ width, height }}
              data-command-slot={id ?? ''}
              {...(id && card && onCardPointerDown
                ? {
                  onPointerDown: (e: ReactPointerEvent) =>
                    onCardPointerDown(e, { instanceId: id, card, faceIndex: inst?.faceIndex ?? 0 }),
                }
                : {})}
              {...(id && onCardClick ? { onClick: () => onCardClick(id) } : {})}
            >
              {hidden ? (
                <div
                  className="flex h-full w-full items-center justify-center rounded-[5%] border border-dashed border-crt-border/60"
                  aria-hidden
                >
                  <span className="font-sc text-[9px] tracking-wider text-crt-faint">CMD</span>
                </div>
              ) : (
                <Card
                  card={card}
                  height={height}
                  {...(id ? { instanceId: id } : {})}
                  faceIndex={inst?.faceIndex ?? 0}
                  inFlight={(!!id && inFlight.has(id)) || held}
                />
              )}
            </div>
          );
        })}
      </div>
      <span className="font-sc text-[9px] tracking-wider text-crt-faint">CMD</span>
    </div>
  );
}
