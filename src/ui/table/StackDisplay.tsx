import { motion } from 'motion/react';
import { Card } from '../card/Card';
import { register, stackItemSlot, zoneSlot } from '../anim/rectRegistry';
import { EASE, SPRING, ds, DUR, STAGGER, d } from '../anim/tokens';
import { identityGradient } from '../../data/cardTypes';
import { useAnim } from '../../store/animStore';
import type { PlayerView } from '../../view/types';

// The stack. Newest on TOP, which is the direction it resolves from.
//
// ⚠️ Resolution order has to be VISIBLE, not merely correct. That is the whole
// reason the choreographer runs groups strictly in order rather than overlapping
// everything it can: watching the top item leave and the rest slide up is how a
// player learns that the stack is LIFO, and a table that resolves three items
// simultaneously teaches them nothing.
//
// ⚠️ The left edge bar is the item's CONTROLLER, not the spell's own colours —
// one of the exactly-five places the MTG colours appear, re-keyed. The card's
// face is right there and says what colour it is; what the picture does NOT say
// is whose spell this is, which is the question you ask before deciding whether
// to respond. It is the seat's commander identity, painted by the same
// `identityGradient` as the underline on their nameplate and the log's rows.

const OFFSET = 26;
const COMPRESSED_OFFSET = 18;
const MAX_VISIBLE = 5;

export function StackDisplay({
  view,
  cardH,
}: {
  view: PlayerView;
  cardH: number;
}) {
  const inFlight = useAnim((s) => s.inFlight);
  const items = view.stack;
  const compressed = items.length > MAX_VISIBLE;
  const offset = compressed ? COMPRESSED_OFFSET : OFFSET;
  const shown = compressed ? items.slice(items.length - MAX_VISIBLE) : items;
  const hidden = items.length - shown.length;
  const cardW = Math.round(cardH * (745 / 1040));

  return (
    <div
      className="relative"
      style={{ width: cardW + 24, height: cardH + offset * Math.max(0, shown.length - 1) }}
      data-stack-size={items.length}
    >
      {/* The zone anchor. Registered whether or not the stack has anything on it,
          so a cast into an EMPTY stack still has somewhere real to fly. */}
      <div
        ref={(el) => register(zoneSlot('stack'), el)}
        data-zone="stack"
        className="absolute"
        style={{ left: 12, top: 0, width: cardW, height: cardH }}
      >
        {items.length === 0 && (
          <div
            className="flex h-full w-full items-center justify-center rounded-[5%] border border-dashed border-crt-border/50"
            aria-hidden
          >
            <span className="font-sc text-[9px] tracking-wider text-crt-faint">STACK</span>
          </div>
        )}
      </div>

      {hidden > 0 && (
        <div className="crt-num absolute -top-4 left-3 rounded bg-crt-raised px-1.5 text-[10px] text-crt-dim ring-1 ring-crt-border">
          +{hidden} below
        </div>
      )}

      {shown.map((item, i) => {
        const card = item.instanceId ? view.cards[item.instanceId] : undefined;
        const isTop = i === shown.length - 1;
        return (
          <motion.div
            key={item.stackItemId}
            className="absolute"
            style={{ left: 12, width: cardW, zIndex: 10 + i }}
            // Items slide UP as the ones above them resolve. Staggered, so a
            // four-deep stack unwinding reads as a sequence.
            initial={{ opacity: 0, y: offset * i + 14 }}
            animate={{ opacity: 1, y: offset * i }}
            transition={{ ...SPRING.fan, delay: (i * d(STAGGER.stackSlideUp)) / 1000 }}
            ref={(el) => register(stackItemSlot(item.stackItemId), el)}
            data-stack-item={item.stackItemId}
            data-stack-top={isTop ? '1' : undefined}
          >
            <div
              className="relative"
              style={{
                borderRadius: 3,
                paddingLeft: 3,
                // The top item is what resolves next, so it gets the accent ring.
                boxShadow: isTop ? '0 0 0 1px var(--color-crt-accent)' : undefined,
              }}
            >
              {/* An element rather than `border-left`, so a two-colour seat
                  reads as both of its colours. See `GameLog`. */}
              <span
                aria-hidden
                className="absolute inset-y-0 left-0 w-[3px] rounded-full"
                style={{
                  background: identityGradient(view.seats[item.controller]?.identity ?? []),
                }}
                data-stack-controller={item.controller}
              />
              {card ? (
                <Card
                  card={card.card}
                  height={cardH}
                  {...(item.instanceId ? { instanceId: item.instanceId } : {})}
                  faceIndex={card.faceIndex}
                  inFlight={!!item.instanceId && inFlight.has(item.instanceId)}
                />
              ) : (
                // An activated or triggered ability is a chit, not a card: there is
                // no card object on the stack to draw.
                <div
                  className="flex items-center rounded bg-crt-raised px-2 ring-1 ring-crt-border"
                  style={{ width: cardW, height: Math.round(cardH * 0.34) }}
                >
                  <span className="truncate font-display text-[11px]">{item.label}</span>
                </div>
              )}
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}

export { EASE, ds, DUR };
