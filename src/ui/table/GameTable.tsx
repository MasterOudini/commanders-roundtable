import { useRef } from 'react';
import { TableSurface } from './TableSurface';
import { PlayerPod } from './PlayerPod';
import { StackDisplay } from './StackDisplay';
import { HandFan } from './HandFan';
import { useTableMetrics } from './useTableMetrics';
import { PhaseTrack } from '../hud/PhaseTrack';
import { GameLog } from '../hud/GameLog';
import { useLayout } from '../../store/layoutStore';
import { useAnim } from '../../store/animStore';
import type { DropCheck } from '../../store/dragStore';
import type { FrozenRect } from '../anim/rectRegistry';
import type { InstanceId, PlayerId, PlayerView, ZoneKind } from '../../view/types';
import type { SeatCount } from './metrics';

// The table. Arena-style seating: my hand at the bottom, my battlefield above it,
// the opponents' battlefields across the table, and a shared stack in the middle.
//
// Rows are absolutely positioned from `layoutStore.metrics.rows` rather than
// stacked with flexbox. Two reasons:
//   • the flight layer needs to know where a zone WILL be, and a computed row top
//     is a number it can use while a flex layout is only knowable after paint;
//   • it guarantees no page scrollbar. The row heights are solved to fit the host
//     before anything renders, so overflow is impossible by construction rather
//     than by hoping the content happens to be short enough.

export function GameTable({
  view,
  seatCount,
  autoStack = true,
  onCardClick,
  onCardDrop,
  dropCheck,
  onCardPointerDown,
  onAttachmentsClick,
  onZoneClick,
  phaseTrackRight,
}: {
  view: PlayerView;
  seatCount: SeatCount;
  autoStack?: boolean;
  onCardClick?: (instanceId: InstanceId, e?: { shiftKey: boolean }, members?: readonly InstanceId[]) => void;
  /**
   * A card was dragged out of the hand and let go over my side of the table, at
   * this rect. Without it the hand does not drag at all — which is exactly what
   * fixture mode wants, since a scenario has no notion of playing a card.
   */
  onCardDrop?: (instanceId: InstanceId, rect: FrozenRect) => void;
  dropCheck?: (instanceId: InstanceId) => DropCheck;
  /** Picking up a permanent on my own battlefield — an Equipment or an Aura. */
  onCardPointerDown?: (instanceId: InstanceId, e: import('react').PointerEvent) => void;
  /** The attachment tab on any permanent, mine or an opponent's. */
  onAttachmentsClick?: (host: InstanceId, x: number, y: number) => void;
  /**
   * A click on one of the closed/open piles — library, graveyard, exile.
   * What each one OFFERS is decided upstairs; this reports the pile.
   */
  onZoneClick?: (player: PlayerId, kind: ZoneKind) => void;
  /**
   * Game-level controls for the right end of the phase bar. A node, so this
   * still knows nothing about the engine — and a slot rather than an overlay
   * because a button floating at `top-2` lands squarely on the phase track and
   * hides two of its steps.
   */
  phaseTrackRight?: import('react').ReactNode;
}) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  useTableMetrics(hostRef, seatCount, true);
  const m = useLayout((s) => s.metrics);
  const hardSyncFlash = useAnim((s) => s.hardSyncFlash);

  const opponents: PlayerId[] = view.seatOrder.filter((p) => p !== view.me);
  const GAP = 8;
  const topOpp = m.rows.phase + GAP;
  const topMiddle = topOpp + m.rows.oppStrip + GAP;
  const topMine = topMiddle + m.rows.middle + GAP;
  const topHand = topMine + m.rows.mySeat + GAP;

  return (
    <div ref={hostRef} className="relative h-full w-full overflow-hidden" data-game-table="">
      <TableSurface />

      {/* One global opacity fade after a hard sync, so a resync is visible without
          being an animation. No clones, no beats — see choreographer.applySnapshot. */}
      <div
        className="absolute inset-0"
        style={{
          opacity: hardSyncFlash ? 0.25 : 1,
          transition: 'opacity 240ms var(--crt-ease-out)',
        }}
      >
        {/* ── The table column, left of the rail ── */}
        <div className="absolute inset-y-0 left-0" style={{ width: m.tableW }}>
          <div className="absolute inset-x-0 top-0">
            <PhaseTrack view={view} {...(phaseTrackRight ? { right: phaseTrackRight } : {})} />
          </div>

          {/* Opponent pods, side by side. */}
          {opponents.map((player, i) => {
            const box = m.seats[i];
            if (!box) return null;
            return (
              <div
                key={player}
                className="absolute"
                style={{ left: box.left, top: topOpp, width: box.width, height: m.rows.oppStrip }}
              >
                <PlayerPod
                  view={view}
                  player={player}
                  orientation="theirs"
                  width={box.width}
                  height={m.rows.oppStrip}
                  bands={m.oppBands}
                  cardH={m.cardH.bfOpp}
                  cardW={m.cardW.bfOpp}
                  rowGap={m.rowGap}
                  minCardH={96}
                  autoStack={autoStack}
                  {...(onCardClick ? { onCardClick } : {})}
                  {...(onAttachmentsClick ? { onAttachmentsClick } : {})}
                  {...(onZoneClick ? { onZoneClick } : {})}
                />
              </div>
            );
          })}

          {/* Middle band: the stack sits right of centre, with the combat lane and
              turn banner to its left. */}
          <div
            className="absolute flex items-start justify-between px-6"
            style={{ left: 0, top: topMiddle, width: m.tableW, height: m.rows.middle }}
            data-middle-band=""
          >
            <div className="flex flex-col gap-1 pt-1">
              <span className="font-sc text-[10px] tracking-wider text-crt-warn">
                {m.fits ? '' : 'WINDOW TOO SMALL — CARDS KEPT READABLE'}
              </span>
            </div>
            <div className="pr-[8%]">
              <StackDisplay view={view} cardH={m.cardH.stack} />
            </div>
          </div>

          {/* My seat. */}
          <div
            className="absolute"
            style={{ left: 0, top: topMine, width: m.tableW, height: m.rows.mySeat }}
          >
            <PlayerPod
              view={view}
              player={view.me}
              orientation="mine"
              width={m.tableW}
              height={m.rows.mySeat}
              bands={m.myBands}
              cardH={m.cardH.bf}
              cardW={m.cardW.bf}
              rowGap={m.rowGap}
              minCardH={96}
              autoStack={autoStack}
              {...(onCardClick ? { onCardClick } : {})}
              {...(onCardDrop ? { onCardDrop } : {})}
              {...(dropCheck ? { dropCheck } : {})}
              {...(onCardPointerDown ? { onCardPointerDown } : {})}
              {...(onAttachmentsClick ? { onAttachmentsClick } : {})}
                  {...(onZoneClick ? { onZoneClick } : {})}
            />
          </div>

          {/* My hand. The bottom of each card is deliberately clipped below the
              viewport edge — it carries nothing you read, and the clipping is what
              gives the fan room to lift on hover without leaving the screen. */}
          <div
            className="absolute overflow-visible"
            style={{ left: 24, top: topHand, width: m.tableW - 48, height: m.rows.hand }}
            data-hand-band=""
          >
            <HandFan
              view={view}
              cardH={m.cardH.hand}
              cardW={m.cardW.hand}
              bandWidth={m.tableW - 48}
              bandHeight={m.rows.hand}
              pitchCap={m.fanPitchCap}
              {...(onCardClick ? { onCardClick } : {})}
              {...(onCardDrop ? { onCardDrop } : {})}
              {...(dropCheck ? { dropCheck } : {})}
            />
          </div>
        </div>

        {/* ── The right rail ── */}
        <aside
          className="absolute inset-y-0 right-0 flex flex-col border-l border-crt-border bg-crt-surface/80"
          style={{ width: m.railW }}
          data-rail=""
        >
          <GameLog log={view.log} seats={view.seats} />
        </aside>
      </div>
    </div>
  );
}
