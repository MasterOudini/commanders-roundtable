import { BattlefieldBand } from './BattlefieldBand';
import { ZonePile } from './ZonePile';
import { CommandZone } from './CommandZone';
import { PlayerPlate } from '../hud/PlayerPlate';
import { podSlot, register, zoneSlot, type FrozenRect } from '../anim/rectRegistry';
import { useDrag, type DropCheck } from '../../store/dragStore';
import { useHandDrag } from './useHandDrag';
import type { PointerEvent as ReactPointerEvent } from 'react';
import type { InstanceId, PlayerId, PlayerView } from '../../view/types';
import { zoneCards, zoneId } from '../../view/types';

// One seat's area. ONE component for both my seat and an opponent's pod, with an
// `orientation` prop, rather than two components.
//
// That is a deliberate call: the two are the same thing mirrored, and two
// components would drift — a fix to band ordering or pile anchoring applied to one
// and not the other is exactly the kind of divergence nobody notices until a card
// flies to the wrong place in a 4-player game.
//
// ⚠️ The COMBAT band is always the band nearest the middle of the table. For me
// that is the TOP of my area; for an opponent it is the BOTTOM of theirs. That
// mirroring is what makes an attack read as crossing the table.

export function PlayerPod({
  view,
  player,
  orientation,
  width,
  height,
  bands,
  cardH,
  cardW,
  rowGap,
  minCardH,
  autoStack = true,
  onCardClick,
  onCardDrop,
  dropCheck,
  onCardPointerDown,
  onAttachmentsClick,
}: {
  view: PlayerView;
  player: PlayerId;
  orientation: 'mine' | 'theirs';
  width: number;
  height: number;
  bands: 1 | 2;
  cardH: number;
  cardW: number;
  rowGap: number;
  minCardH: number;
  autoStack?: boolean;
  onCardClick?: (instanceId: InstanceId) => void;
  /** Only MY pod takes these, and only its command zone uses them. */
  onCardDrop?: (instanceId: InstanceId, rect: FrozenRect) => void;
  dropCheck?: (instanceId: InstanceId) => DropCheck;
  /** Only MY bands take this: it is how an Equipment on the table is picked up. */
  onCardPointerDown?: (instanceId: InstanceId, e: ReactPointerEvent) => void;
  /** Every pod takes this: what is on a creature is worth reading on any seat. */
  onAttachmentsClick?: (host: InstanceId, x: number, y: number) => void;
}) {
  const mine = orientation === 'mine';
  const seat = view.seats[player];
  const headerH = 34;
  const contentH = Math.max(60, height - headerH);

  // ⚠️ MY pod is the drop zone, and only mine. Selectors, not booleans in a
  // store: the gesture finds the zone by `[data-drop-zone="bf"]` and reads its
  // rect once, so the zone is wherever this element actually is — there is no
  // second copy of the geometry to drift.
  //
  // Three states, all decided by the drag store so this component stays unaware
  // of what a card IS: nothing held, held-and-elsewhere (armed), held-over-me.
  // Whose turn it is, at pod scale. One lit seat out of four is readable from
  // across the room, which is the point — the phase bar names the player, and
  // this is what makes you not have to read it.
  const activeTurn = view.turn.active === player && !view.seats[player]?.lost;
  const dragging = useDrag((s) => mine && s.phase === 'dragging');
  const dropOk = useDrag((s) => mine && s.phase === 'dragging' && s.over && s.ok);
  const dropRefused = useDrag((s) => mine && s.phase === 'dragging' && s.over && !s.ok);

  // ⚠️ THE PILE BLOCK IS SOLVED, NOT ASSUMED.
  //
  // Two bugs came from guessing at it. (a) The reserved width was computed for ONE
  // pile while the markup rendered TWO side by side, so the piles overlapped the
  // battlefield row — invisible at 2 seats where there is width to spare, obvious
  // at 4. (b) A 2×2 grid of 60 px piles plus their labels needs ~150 px, which does
  // not fit a COLLAPSED pod's 108 px of content height, so the pile column
  // overflowed its pod and the pods rendered 250 px tall inside a 142 px row.
  //
  // So: pick the grid shape from the height that is actually available, then derive
  // the width from the shape. The four zones (library, graveyard, exile, command)
  // are always all four — a hidden zone is exactly the case the flight layer needs
  // an anchor for.
  // ⚠️ THE ORDER IS COMMAND, EXILE, LIBRARY, GRAVEYARD, top to bottom — asked
  // for, and it is the order a player actually reaches for: the commander is the
  // card you look at every turn, the graveyard the one you look at least.
  //
  // The command zone is a BOX of one slot per commander rather than a pile, so a
  // partner pair shows both faces; the other three are piles as before. That box
  // is as wide as its commanders, which is why the column count is solved from
  // the commander COUNT rather than assumed.
  const LABEL_H = 12;
  const PILE_GAP = 4;
  const idealPileH = Math.round(cardH * 0.62);
  const commanderCount = Math.max(1, zoneCards(view, zoneId('cmd', player)).length);

  let twoRows = true;
  let pileH = Math.min(idealPileH, Math.floor((contentH - PILE_GAP - 2 * LABEL_H) / 2));
  if (pileH < 44) {
    // Not enough height for two rows: everything goes in one, still in order.
    twoRows = false;
    pileH = Math.min(idealPileH, contentH - LABEL_H - PILE_GAP);
  }
  pileH = Math.max(34, pileH);
  const pileW = Math.round(pileH * (745 / 1040));

  // ⚠️ THE BLOCK'S WIDTH IS A FIXED BUDGET, and the pile sizes are solved to fit
  // INSIDE it — never the other way round. Every pixel here comes off `bandW`,
  // and re-ordering these zones by simply adding a third column cost the
  // battlefield ~60 px per pod and put THREE bands into scrolling, which is the
  // fourth rung of the packing ladder and a quality bar the battery holds.
  // Two columns when the block has room to stack, four when everything must fit
  // one row — exactly what it was before the command zone moved to the top.
  const budgetCols = twoRows ? 2 : 4;
  const pileBlockW = budgetCols * pileW + (budgetCols - 1) * PILE_GAP + 8;

  /** Fit `n` slots across the budget, and never below a readable floor. */
  const fitAcross = (n: number): number => {
    const w = Math.floor((pileBlockW - (n - 1) * PILE_GAP - 8) / n);
    return Math.max(30, Math.round(w / (745 / 1040)));
  };

  // ── The stacked shape: command, then library + graveyard, then exile on its
  // side underneath them.
  //
  // ⚠️ Solved against the HEIGHT, because it is now three rows and the last one
  // is a turned pile — which is `0.716 × h` tall rather than `h`, and that
  // difference is most of what makes three rows fit where two used to.
  //
  //   cmd + label + gap + zone + label + gap + (zone × 0.716) + label ≤ contentH
  const PORTRAIT = 745 / 1040;
  const stackedFit = Math.floor((contentH - 3 * LABEL_H - 2 * PILE_GAP) / (2 + PORTRAIT));
  const stacked = twoRows && stackedFit >= 44;

  const cmdH = stacked ? Math.min(pileH, stackedFit) : twoRows ? pileH : fitAcross(commanderCount + 3);
  // Two piles share the middle row, so they are bigger than the old three-across.
  const zoneH = stacked ? cmdH : twoRows ? fitAcross(3) : cmdH;
  // ⚠️ Sideways only when the block is STACKED. Lying the exile down makes it
  // ~1.4 slots wide, which does not fit a pod that already has to put everything
  // in one row — and a pile that overflows its block is worse than an upright one.
  const exileSideways = stacked;

  const bandW = Math.max(120, width - pileBlockW - 8);
  const perBand = Math.max(
    minCardH + 12,
    Math.floor((contentH - (bands - 1) * 10) / bands),
  );

  // Dragging the commander out of the command zone to cast it.
  //
  // ⚠️ The SAME gesture the hand uses, and the same `onCardDrop` — so a commander
  // is cast by exactly the code that casts a spell from hand, commander tax and
  // all, and there is no second answer to "what does playing this card do". Two
  // instances of the hook coexist safely: both refuse to start while
  // `useDrag.phase !== 'idle'`, so only one card is ever in the air.
  //
  // ⚠️ The ghost is sized to the PILE, not the battlefield card. Picking up a
  // 44 px pile card and finding a 130 px card under the cursor reads as having
  // grabbed something else.
  const cmdDrag = useHandDrag({
    cardW: Math.round(cmdH * (745 / 1040)),
    cardH: cmdH,
    ...(mine && onCardDrop ? { onCardDrop } : {}),
    ...(mine && dropCheck ? { dropCheck } : {}),
  });

  const combat = (
    <BattlefieldBand
      view={view}
      player={player}
      band="combat"
      cardH={cardH}
      cardW={cardW}
      width={bandW}
      height={perBand}
      gap={rowGap}
      minCardH={minCardH}
      autoStack={autoStack}
      {...(onCardClick ? { onCardClick } : {})}
      {...(mine && onCardPointerDown ? { onCardPointerDown } : {})}
      {...(onAttachmentsClick ? { onAttachmentsClick } : {})}
    />
  );
  const support =
    bands === 2 ? (
      <BattlefieldBand
        view={view}
        player={player}
        band="support"
        cardH={cardH}
        cardW={cardW}
        width={bandW}
        height={perBand}
        gap={rowGap}
        minCardH={minCardH}
        autoStack={autoStack}
        {...(onCardClick ? { onCardClick } : {})}
        {...(mine && onCardPointerDown ? { onCardPointerDown } : {})}
        {...(onAttachmentsClick ? { onAttachmentsClick } : {})}
      />
    ) : null;

  return (
    <div
      ref={(el) => register(podSlot(player), el)}
      className="relative flex flex-col rounded-lg border bg-crt-table-lo/40"
      style={{
        width,
        height,
        // ⚠️ `contain: layout paint` also establishes a containing block for any
        // `position: fixed` DESCENDANT and clips it. That is why the targeting
        // arrow is mounted at the app root and not inside a pod — an arrow drawn
        // in here would be positioned against this box and scissored at its edge.
        contain: 'layout paint',
        // The armed state is deliberately quiet — a card is in the air, and the
        // table saying so once is enough. Only the OVER state is loud, because
        // that is the moment the drop is decided.
        //
        // ⚠️ Refusal is signalled by SHAPE, not by colour. `--color-crt-warn` and
        // `--color-crt-accent` are 4° apart in hue, so a warn border read as a
        // slightly different yes; and red on this table already means damage. A
        // dashed edge cannot be mistaken for the lit one at any glance, and it
        // survives a colour-blind viewer unchanged.
        //
        // ⚠️ THE ACTIVE TURN IS BRASS, and it is brass rather than the seat's own
        // identity gradient on purpose: the five MTG colours appear in exactly
        // five places (see `PlayerPlate`), and "whose turn" is a UI state, not a
        // fact about anyone's mana. A drag is momentary and still wins — a card
        // in the air is the more urgent question — so the turn's edge simply
        // rejoins underneath it when the drag ends.
        borderColor:
          dropOk || dropRefused
            ? 'var(--color-crt-accent)'
            : dragging
              ? 'var(--color-crt-accent-lo)'
              : activeTurn
                ? 'color-mix(in oklab, var(--color-crt-accent) 68%, transparent)'
                : 'color-mix(in oklab, var(--color-crt-border) 50%, transparent)',
        borderStyle: dropRefused ? 'dashed' : 'solid',
        boxShadow: dropOk
          ? 'inset 0 0 34px oklch(0.780 0.115 78 / 0.16)'
          : activeTurn
            ? 'inset 0 0 0 1px oklch(0.780 0.115 78 / 0.30), inset 0 0 52px oklch(0.780 0.115 78 / 0.08)'
            : undefined,
        transition: 'border-color 140ms var(--crt-ease-out), box-shadow 140ms var(--crt-ease-out)',
      }}
      data-pod={player}
      data-pod-active-turn={activeTurn ? '1' : undefined}
      data-pod-orientation={orientation}
      data-pod-bands={bands}
      {...(mine ? { 'data-drop-zone': 'bf' } : {})}
      data-drop-state={dropOk ? 'ok' : dropRefused ? 'refused' : dragging ? 'armed' : undefined}
    >
      {/* An opponent's plate is at the top of their pod, mine at the bottom of
          mine — in both cases the nameplate is furthest from the table's middle,
          so the cards are what occupy the centre. */}
      {!mine && <PlayerPlate view={view} player={player} compact />}

      <div className="flex min-h-0 flex-1 gap-2 px-2 py-1">
        {/* ⚠️ The battlefield's own zone anchor. Cards in a band register
            `card:<id>` slots, but a permanent resolving into a pod whose card slot
            is not registered yet — or into a COLLAPSED pod, where the support band
            is not rendered at all — needs `zone:bf:<player>` to fall back to.
            Without it, rectRegistry.resolve() drops straight to the viewport
            centre and the card lands in the middle of the table. That failure only
            shows up for hidden or collapsed pods, which is exactly when nobody is
            watching that pod. */}
        <div
          ref={(el) => register(zoneSlot(zoneId('bf', player)), el)}
          data-zone={zoneId('bf', player)}
          className="flex min-w-0 flex-1 flex-col gap-[10px]"
        >
          {/* Mirrored: my combat band on top, theirs on the bottom. */}
          {mine ? (
            <>
              {combat}
              {support}
            </>
          ) : (
            <>
              {support}
              {combat}
            </>
          )}
        </div>

        <div
          className="flex shrink-0 flex-wrap content-center justify-center"
          style={{ width: pileBlockW, gap: PILE_GAP }}
          data-pile-block={player}
        >
          {/* Each commander is castable straight out of here — drag one onto the
              battlefield, or click it, exactly like a card in hand. */}
          <CommandZone
            view={view}
            player={player}
            height={cmdH}
            {...(mine && onCardDrop ? { onCardPointerDown: cmdDrag.onPointerDown } : {})}
            {...(mine && onCardClick
              ? {
                onCardClick: (id: InstanceId) => {
                  // The tail of a drag also fires a click; playing the commander
                  // twice for one gesture is exactly what that would do.
                  if (cmdDrag.suppressClick()) return;
                  onCardClick(id);
                },
              }
              : {})}
          />
          <ZonePile view={view} player={player} kind="lib" height={zoneH} faceDown />
          <ZonePile view={view} player={player} kind="gy" height={zoneH} />
          {/* Underneath both, lying on its side the way a deck sits on a mat. */}
          <div className={exileSideways ? 'flex w-full justify-center' : 'contents'}>
            <ZonePile
              view={view}
              player={player}
              kind="exile"
              height={zoneH}
              sideways={exileSideways}
            />
          </div>
        </div>
      </div>

      {mine && <PlayerPlate view={view} player={player} />}

      {/* An opponent's hand is a COUNT, never a fan of backs: at 3–4 players a
          fanned back-stack per pod costs horizontal space the bands need, and the
          count is the only fact you can actually use. It doubles as the flight
          destination anchor for their draws — which is why it is registered even
          when the count is zero. */}
      {!mine && (
        <div
          ref={(el) => register(zoneSlot(zoneId('hand', player)), el)}
          data-zone={zoneId('hand', player)}
          data-hand-chip={player}
          className="crt-num absolute right-2 top-1 flex items-center gap-1 rounded bg-crt-void/80 px-1.5 text-[10px] text-crt-dim ring-1 ring-crt-border"
          aria-label={`${seat?.name ?? player} has ${view.hiddenCounts[zoneId('hand', player)] ?? 0} cards in hand`}
        >
          <span className="opacity-70">✋</span>
          {view.hiddenCounts[zoneId('hand', player)] ?? 0}
        </div>
      )}
    </div>
  );
}
