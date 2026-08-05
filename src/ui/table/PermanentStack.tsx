import type { PointerEvent as ReactPointerEvent } from 'react';
import { motion } from 'motion/react';
import { Card } from '../card/Card';
import { SPRING } from '../anim/tokens';
import { ATTACH_MAX_VISIBLE, ATTACH_OFFSET_Y, type PackedCard } from './packRow';
import { useAnim } from '../../store/animStore';
import type { PlayerView } from '../../view/types';

// One battlefield slot: either a single permanent, or a pile of identical ones.
//
// ⚠️ Auto-stacking is LOAD-BEARING, not a nicety — see D19. At 4 players a pod's
// row is ~510 px and an opponent card is 83 px, so a row holds five cards, while a
// real Commander board is 10 lands + 6 other noncreatures + 5 creatures. Twelve
// Forests have to occupy one slot or the board does not fit at 1080p.
//
// The sub-badge (`7/12 untapped`) is why grouping is strict about tap state: a pile
// that merged tapped and untapped lands would hide the one fact you need before
// deciding whether you can cast something.

export function PermanentStack({
  view,
  packed,
  height,
  tapDelayMs = 0,
  reflowDelayMs = 0,
  instantX = false,
  turnOnMount = false,
  onClick,
  onPointerDown,
  onAttachmentsClick,
}: {
  view: PlayerView;
  packed: PackedCard;
  /** Staggers this slot's tap transition during a coalesced row sweep. */
  tapDelayMs?: number;
  /**
   * Holds this slot's slide back until the cards have finished straightening.
   * Set by the band, and only when the row is CLOSING — see the note there.
   */
  reflowDelayMs?: number;
  /** The window resized: take the new column immediately, do not slide to it. */
  instantX?: boolean;
  /**
   * This slot arrived on its own, so a card that is already tapped should mount
   * upright and turn rather than appear turned. The band decides — see there.
   */
  turnOnMount?: boolean;
  /**
   * ⚠️ The EXACT rendered height, taken from `PackedRow.cardH`. Do NOT recompute
   * it here as `round(cardH * scale)`: the packer already spaced this row using a
   * width derived from that rounded height, and rounding the same number twice in
   * two places put the last card in a row 2.7 px past its band's right edge.
   */
  height: number;
  /**
   * A click on this permanent, with the browser's own account of it and — when
   * this slot is a PILE — every card the pile stands for. This file knows there
   * was a click and nothing else; what a plain one versus a shift-one MEANS is
   * decided upstairs, the same seam `onPointerDown` keeps.
   *
   * ⚠️ The members are handed over rather than re-derived because "identical" is
   * this file's neighbour's rule (`groupIdentical`: same oracle id, tapped
   * state, counters, sickness, no attachments) and a second copy of it upstairs
   * would eventually disagree about what one slot contains — the exact failure
   * `tier3.ts` warns about for second heuristics.
   */
  onClick?: (instanceId: string, e?: { shiftKey: boolean }, members?: readonly string[]) => void;
  /**
   * A press on this permanent, forwarded with its instance id. What it MEANS is
   * decided upstairs — this file knows there is a press and nothing else, the
   * same seam `onClick` keeps.
   */
  onPointerDown?: (instanceId: string, e: ReactPointerEvent) => void;
  /** The attachment tab was clicked: show what is on this permanent. */
  onAttachmentsClick?: (host: string, x: number, y: number) => void;
}) {
  const inFlight = useAnim((s) => s.inFlight);
  const card = view.cards[packed.instanceId];
  if (!card) return null;

  const count = packed.members.length;
  const hiddenBehind = Math.min(count - 1, 3);

  return (
    <motion.div
      className="absolute"
      // ⚠️ SIZED TO THE FOOTPRINT, which for a tapped card is the TURNED box —
      // `height × width`, anchored on the same corner the upright card used. The
      // Card inside keeps its own upright layout box and reaches that shape with a
      // transform, so nothing here moves when it turns; but the badges, the pile
      // plates and `data-band-slot` all hang off this box, and they have to sit on
      // the card you can actually see.
      //
      // ⚠️ THE COLUMN POSITION IS ANIMATED, not set as `left`. A tap changes this
      // slot's footprint by (h − w) px and re-centres the whole row, so every
      // neighbour's x changes on the same commit that starts the turn. As a plain
      // `left` that was a teleport: measured on a real untap, the slot jumped
      // 69 px to the right while the card was still lying flat, and only then
      // unrolled — the card appeared to move sideways and turn as two separate
      // events. Animated, the row parts and closes around the turn instead, which
      // is the same thing the hand fan does with the same spring.
      style={{
        left: 0,
        top: 0,
        width: packed.footprintW,
        height: packed.footprintH,
        zIndex: 1,
      }}
      // A card arriving in a row settles rather than appearing. The bounce is the
      // point; without it a permanent entering the battlefield reads as a DOM
      // insertion instead of an object being put down.
      //
      // ⚠️ `x` is in `initial` as well, or a card entering the battlefield slides
      // in from the band's left edge instead of appearing where it belongs.
      initial={{ opacity: 0, scale: 0.9, x: packed.x }}
      animate={{ opacity: 1, scale: 1, x: packed.x }}
      // ⚠️ The delay is on `x` ALONE. A card arriving in a row while another one
      // untaps must still settle immediately — it has nothing to wait for, and
      // holding its fade-in would read as a dropped frame.
      transition={
        instantX
          ? { ...SPRING.fan, x: { duration: 0 } }
          : reflowDelayMs > 0
            ? { ...SPRING.fan, x: { ...SPRING.fan, delay: reflowDelayMs / 1000 } }
            : SPRING.fan
      }
      data-band-slot={packed.instanceId}
      data-stack-count={count}
      {...(onPointerDown
        ? { onPointerDown: (e: ReactPointerEvent) => onPointerDown(packed.instanceId, e) }
        : {})}
    >
      {/* Offset plates for the hidden members of the pile. Max 3, per the spec:
          beyond that the offset would eat the neighbouring slot. */}
      {Array.from({ length: hiddenBehind }, (_, i) => (
        <div
          key={i}
          aria-hidden
          className="absolute rounded-[5%] border border-crt-border/60 bg-crt-inset"
          style={{
            inset: 0,
            transform: `translate(${(i + 1) * 3}px, ${-(i + 1) * 3}px)`,
            zIndex: -1,
          }}
        />
      ))}

      <Card
        card={card.card}
        height={height}
        instanceId={packed.instanceId}
        faceIndex={card.faceIndex}
        faceDown={card.faceDown}
        power={card.power}
        toughness={card.toughness}
        // ⚠️ The battlefield is the only place these mean anything: a card in a
        // hand or a graveyard has no counters and shows its printed value. The
        // engine puts them on at entry (CR 306.5b/310.6) and SBA 4 reads them
        // back, so this is the number the player is watching count down.
        loyalty={card.counters['loyalty'] ?? null}
        defense={card.counters['defense'] ?? null}
        tapped={card.tapped}
        summoningSick={card.summoningSick}
        damage={card.damage}
        tapDelayMs={tapDelayMs}
        turnOnMount={turnOnMount}
        inFlight={inFlight.has(packed.instanceId)}
        {...(onClick
          ? { onClick: (e: { shiftKey: boolean }) => onClick(packed.instanceId, e, packed.members) }
          : {})}
      />

      {count > 1 && (
        <>
          <div
            className="crt-num pointer-events-none absolute -right-1.5 -top-1.5 rounded-full bg-crt-accent px-1.5 text-[11px] text-crt-on-accent"
            data-pile-count={count}
          >
            ×{count}
          </div>
          <div
            className="crt-num pointer-events-none absolute -bottom-1 left-0 right-0 truncate rounded bg-crt-void/85 px-1 text-center text-[9px] text-crt-dim"
            data-pile-untapped={packed.untapped}
          >
            {packed.untapped}/{count} untapped
          </div>
        </>
      )}

      {/* ⚠️ The tucked cards are the right PICTURE and a bad AFFORDANCE: 13 px of
          card edge, carrying no name and nothing to click. This tab is the way in
          — it reads as the edges of the cards stacked behind, sitting just off the
          host's left side, and it opens the list. */}
      {packed.attachments.length > 0 && onAttachmentsClick && (
        <button
          type="button"
          data-attachments={packed.instanceId}
          data-attachment-count={packed.attachments.length}
          aria-label={`${packed.attachments.length} attached to this permanent`}
          title={`${packed.attachments.length} attached — click to see them`}
          className="absolute z-20 flex items-center gap-[3px] rounded-l-sm border border-r-0 border-crt-accent-lo bg-crt-void/90 py-1 pl-[3px] pr-[2px] hover:bg-crt-raised"
          style={{ left: -9, top: '32%' }}
          // ⚠️ The press must not reach the slot wrapper: that is the handler that
          // picks a permanent UP, and pressing this tab would start dragging the
          // creature the tab belongs to.
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
            onAttachmentsClick(packed.instanceId, r.left, r.bottom + 4);
          }}
        >
          {/* Two thin plates: the edges of the cards behind, in miniature. */}
          <span aria-hidden className="block h-3 w-[2px] rounded-sm bg-crt-accent/70" />
          <span aria-hidden className="block h-3 w-[2px] rounded-sm bg-crt-accent/40" />
          <span className="crt-num pl-[1px] text-[9px] leading-none text-crt-accent-hi">
            {packed.attachments.length}
          </span>
        </button>
      )}

      {/* Auras and equipment tuck UNDER their host rather than taking a row slot
          of their own — an Equipment in its own slot loses the one thing you need
          to know about it, which is what it is attached to. */}
      {packed.attachments.slice(0, ATTACH_MAX_VISIBLE).map((id, i) => {
        const att = view.cards[id];
        if (!att) return null;
        return (
          <div
            key={id}
            className="absolute left-0"
            style={{
              top: (i + 1) * ATTACH_OFFSET_Y,
              zIndex: -2 - i,
              transform: 'scale(0.86)',
              transformOrigin: 'top left',
            }}
            // ⚠️ An attachment is pick-up-able too, and it has to be: an
            // Equipment that can be attached ONCE and never moved is worse than
            // one that cannot be attached at all. It carries its OWN id here —
            // the host's slot wrapper is the element a press would otherwise
            // bubble to, which would pick up the creature instead.
            {...(onPointerDown
              ? { onPointerDown: (e: ReactPointerEvent) => { e.stopPropagation(); onPointerDown(id, e); } }
              : {})}
          >
            <Card
              card={att.card}
              height={height}
              instanceId={id}
              faceIndex={att.faceIndex}
              tapped={att.tapped}
              inFlight={inFlight.has(id)}
            />
          </div>
        );
      })}

      {packed.attachments.length > ATTACH_MAX_VISIBLE && (
        <div className="crt-num pointer-events-none absolute -bottom-4 right-0 rounded bg-crt-raised px-1 text-[9px] text-crt-dim">
          +{packed.attachments.length - ATTACH_MAX_VISIBLE}
        </div>
      )}
    </motion.div>
  );
}
