import { LifeCounter } from './LifeCounter';
import { ManaPool } from './ManaPool';
import { CommanderDamageMatrix } from './CommanderDamageMatrix';
import { identityGradient } from '../../data/cardTypes';
import { plateSlot, register } from '../anim/rectRegistry';
import type { PlayerId, PlayerView } from '../../view/types';

// A seat's nameplate: name, life, commander damage, mana pool.
//
// ⚠️ The GRADIENT UNDERLINE is the fifth and quietly most useful of the five places
// the MTG colours are allowed to appear. It is that player's COMMANDER's colour
// identity, and it is how you tell four pods apart at a glance without reading a
// single name — which at a 4-player table is something you do constantly. The
// other four places are mana pips, the 2 px edge bar on stack items and log rows,
// the flight glow, and the mana pool wells. Nowhere else.

export function PlayerPlate({
  view,
  player,
  compact = false,
}: {
  view: PlayerView;
  player: PlayerId;
  compact?: boolean;
}) {
  const seat = view.seats[player];
  if (!seat) return null;

  const isActive = view.turn.active === player;
  const hasPriority = view.priority === player;

  return (
    <div
      ref={(el) => register(plateSlot(player), el)}
      className="relative flex items-center gap-3 px-2"
      style={{ height: compact ? 30 : 34 }}
      data-plate={player}
      data-active={isActive ? '1' : undefined}
      data-priority={hasPriority ? '1' : undefined}
    >
      {/* Priority is signalled by a solid ring AND by the PromptBar text AND by
          motion — every animated state change in this app has a non-motion signal
          too, so reduced-motion loses nothing.
          ⚠️ GREEN, because BRASS is whose turn it is. This ring was brass while
          `PlayerPod`'s active-turn edge is brass, so a seat that had both showed
          one colour twice and answered neither question. Green here and brass
          there means a glance at a pod reads both at once. See
          `PriorityIndicator`, which is the same colour for the same reason. */}
      {hasPriority && (
        <span
          aria-hidden
          className="absolute inset-x-0 inset-y-[2px] rounded"
          style={{ boxShadow: 'inset 0 0 0 1px var(--color-crt-ok)' }}
        />
      )}

      {/* ⚠️ `isActive` was computed and rendered NOTHING — the plate said who had
          priority and never said whose turn it was, which are different
          questions and the second is the one you ask first. The name going
          brass is the answer at plate scale; `PlayerPod` lights the whole seat
          for the answer you get without looking. */}
      <span
        className={`font-display truncate text-sm ${
          seat.lost
            ? 'text-crt-faint line-through'
            : isActive
              ? 'text-crt-accent-hi'
              : ''
        }`}
        title={seat.name}
      >
        {seat.name}
      </span>

      {isActive && !seat.lost && (
        <span
          className="font-sc shrink-0 rounded-[3px] bg-crt-accent px-1 text-[9px] leading-[13px] tracking-wider text-crt-on-accent"
          data-turn-badge={player}
        >
          TURN
        </span>
      )}

      <LifeCounter
        life={seat.life}
        className={`text-base tabular-nums ${seat.life <= 5 ? 'text-crt-danger' : ''}`}
      />

      <CommanderDamageMatrix view={view} player={player} />

      {/* ⚠️ Ten poison is a loss, exactly like 0 life, so it has to be READABLE
          before it fires. Shown only when there is any, because a permanent "0"
          on four plates is noise on the great majority of tables that never see
          an infect creature. Turns red at 8, two turns of a typical infect
          attack away — the same warning distance as the life counter's 5. */}
      {seat.poison > 0 && (
        <span
          className={`crt-num rounded px-1 text-xs tabular-nums ${
            seat.poison >= 8 ? 'text-crt-danger' : 'text-crt-dim'
          }`}
          style={{ boxShadow: 'inset 0 0 0 1px currentColor' }}
          title={`${seat.poison} poison — ten is a loss`}
          data-poison={player}
        >
          ☠ {seat.poison}
        </span>
      )}

      <div className="ml-auto flex items-center gap-2">
        <ManaPool pool={seat.manaPool} />
      </div>

      {/* The commander colour-identity underline.
          ⚠️ `identityGradient` is shared with the game log and the stack, which
          now paint the same seat the same way. It used to be a private copy
          here; two implementations of "what colour is this player" would drift,
          and a log row that disagreed with the pod it points at is worse than
          no colour at all. */}
      <span
        aria-hidden
        className="absolute bottom-0 left-2 right-2 h-[2px] rounded-full"
        style={{ background: identityGradient(seat.identity, 90) }}
      />
    </div>
  );
}
