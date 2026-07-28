import type { PointerEvent as ReactPointerEvent } from 'react';
import { Card } from '../card/Card';
import { register, zoneSlot } from '../anim/rectRegistry';
import { useAnim } from '../../store/animStore';
import { useDrag } from '../../store/dragStore';
import type { CardData } from '../../data/cardTypes';
import type { PlayerId, PlayerView, ZoneKind } from '../../view/types';
import { zoneCards, zoneId } from '../../view/types';

// Graveyard / exile / library / command zone. The top card plus a count.
//
// ⚠️ EVERY pile registers a zone anchor, whether or not it has a card in it. That
// anchor is the second tier of `rectRegistry.resolve()`, and it is what makes
// "move any card to any zone" work without a single hand-written case: an empty
// graveyard, a library you cannot see into, and a collapsed pod all expose an
// anchor, so a flight always has somewhere real to land. Skipping the anchor when
// the pile is empty would make the FIRST card into a graveyard fly to the middle
// of the screen instead — a bug that only appears on an empty zone, which is
// exactly when nobody is looking.

const LABELS: Record<ZoneKind, string> = {
  gy: 'Graveyard',
  exile: 'Exile',
  lib: 'Library',
  cmd: 'Command',
  hand: 'Hand',
  bf: 'Battlefield',
};

const SHORT: Record<ZoneKind, string> = {
  gy: 'GY',
  exile: 'EX',
  lib: 'LIB',
  cmd: 'CMD',
  hand: 'H',
  bf: 'BF',
};

export function ZonePile({
  view,
  player,
  kind,
  height,
  /** Libraries and opponents' hands show a count, never a face. */
  faceDown = false,
  sideways = false,
  onClick,
  onTopPointerDown,
}: {
  view: PlayerView;
  player: PlayerId;
  kind: ZoneKind;
  height: number;
  faceDown?: boolean;
  /**
   * Draw this pile lying on its side, a quarter turn to the right — the way a
   * deck sits on a real playmat.
   *
   * ⚠️ The SLOT turns, not just the card. `Card`'s own tap transform (D75) keeps
   * the layout box portrait on purpose, which is right for a battlefield row and
   * wrong here: a pile in a wrapping block has to RESERVE the landscape
   * footprint or the next item overlaps it.
   */
  sideways?: boolean;
  onClick?: () => void;
  /**
   * Lets the TOP card of this pile be picked up and dragged — wired only for a
   * pile whose top card the player may actually play (their own command zone).
   *
   * ⚠️ The top card, and no other. A pile draws one face; dragging anything else
   * out of it would be dragging a card the player cannot see. With two partners
   * that means casting them in the order they are stacked, which is at least the
   * order the pile shows.
   */
  onTopPointerDown?: (
    e: ReactPointerEvent,
    card: { instanceId: string; card: CardData | null; faceIndex: number },
  ) => void;
}) {
  const zone = zoneId(kind, player);
  const ids = zoneCards(view, zone);
  const hiddenCount = view.hiddenCounts[zone];
  const count = hiddenCount ?? ids.length;
  const inFlight = useAnim((s) => s.inFlight);

  // The TOP of a pile is its last entry — a graveyard's newest card, the card a
  // draw takes off the library.
  const topId = ids[ids.length - 1];
  const top = topId ? view.cards[topId] : undefined;
  const topHidden = faceDown || !top?.card;
  const width = Math.round(height * (745 / 1040));

  // A card being dragged out of this pile is drawn by the drag layer instead, so
  // the pile must not also draw it — otherwise the commander is in two places at
  // once, and the one left behind is the one you are not holding.
  const held = useDrag((s) => s.phase !== 'idle' && s.instanceId === topId);
  const draggable = !!onTopPointerDown && !!topId && !topHidden;

  // The turn is `translate(h, 0) rotate(90deg)` about the top-left, which is the
  // same mapping D75 works out for a tapped permanent: it lands the turned box
  // exactly on the landscape footprint reserved for it.
  const boxW = sideways ? height : width;
  const boxH = sideways ? width : height;

  return (
    <div className="flex shrink-0 flex-col items-center gap-1">
      <div
        // The anchor element. Registered unconditionally — see the note above.
        ref={(el) => register(zoneSlot(zone), el)}
        data-zone={zone}
        data-zone-count={count}
        data-zone-sideways={sideways ? '1' : undefined}
        className="relative"
        style={{ width: boxW, height: boxH }}
        onClick={onClick}
        role={onClick ? 'button' : undefined}
        tabIndex={onClick ? 0 : undefined}
        aria-label={`${LABELS[kind]}: ${count} card${count === 1 ? '' : 's'}`}
        onKeyDown={onClick ? (e) => { if (e.key === 'Enter') onClick(); } : undefined}
      >
        {/* ⚠️ ONLY THE CARDS TURN. The empty slot's label and the count badge stay
            in this box, upright: a sideways pile is a deck lying on the mat, not
            a screen tipped over, and text that has to be read with your head
            tilted is just a bug with an explanation. */}
        {count > 0 && (
          <div
            className="absolute left-0 top-0"
            style={
              sideways
                ? {
                  width,
                  height,
                  transform: `translate(${height}px, 0) rotate(90deg)`,
                  transformOrigin: 'top left',
                }
                : { width, height }
            }
          >
            {/* Two offset plates behind the top card, so a 40-card library reads
                as a physical stack rather than as one card. Purely decorative and
                capped at two: a real depth stack of 40 elements would be 40
                composited layers. */}
            {count > 1 && (
              <div
                aria-hidden
                className="absolute rounded-[5%] border border-crt-border/70 bg-crt-inset"
                style={{ inset: 0, transform: 'translate(3px, -3px)' }}
              />
            )}
            {count > 2 && (
              <div
                aria-hidden
                className="absolute rounded-[5%] border border-crt-border/50 bg-crt-inset"
                style={{ inset: 0, transform: 'translate(6px, -6px)' }}
              />
            )}

            <div
              className={`absolute inset-0 ${draggable ? 'cursor-grab active:cursor-grabbing' : ''}`}
              {...(draggable
                ? {
                  onPointerDown: (e: ReactPointerEvent) =>
                    onTopPointerDown(e, {
                      instanceId: topId,
                      card: top?.card ?? null,
                      faceIndex: top?.faceIndex ?? 0,
                    }),
                  'data-pile-draggable': zone,
                }
                : {})}
            >
              <Card
                card={topHidden ? null : (top?.card ?? null)}
                height={height}
                {...(topId ? { instanceId: topId } : {})}
                faceDown={topHidden}
                {...(top ? { faceIndex: top.faceIndex } : {})}
                inFlight={(!!topId && inFlight.has(topId)) || held}
                {...(topHidden ? { mode: 'back' as const } : {})}
              />
            </div>
          </div>
        )}

        {/* The empty slot takes the shape the pile actually occupies — landscape
            when it is lying down — and says so the right way up. */}
        {count === 0 && (
          <div
            className="flex h-full w-full items-center justify-center rounded-[5%] border border-dashed border-crt-border/60"
            aria-hidden
          >
            <span className="font-sc text-[9px] tracking-wider text-crt-faint">{SHORT[kind]}</span>
          </div>
        )}

        {count > 1 && (
          <div
            className="crt-num pointer-events-none absolute -bottom-1 -right-1 rounded bg-crt-void/90 px-1 text-[10px] text-crt-dim ring-1 ring-crt-border"
            data-zone-badge={zone}
          >
            {count}
          </div>
        )}
      </div>
      <span className="font-sc text-[9px] tracking-wider text-crt-faint">{SHORT[kind]}</span>
    </div>
  );
}
