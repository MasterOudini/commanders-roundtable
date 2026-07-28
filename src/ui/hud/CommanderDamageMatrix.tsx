import type { PlayerId, PlayerView } from '../../view/types';

// Commander damage received by this seat, one chip per opponent.
//
// It is always visible rather than behind a hover, because 21 commander damage is
// a way to lose that players routinely forget about until it happens — and unlike
// life total, nothing else on screen hints at it. At 4 players that is three small
// chips, which is cheap for removing an entire class of "wait, I lost?".
//
// Violet (`--color-crt-cmd`) is deliberately not one of the five MTG colours and
// not the brass accent either, so a commander-damage chip cannot be mistaken for
// anything else on the table.

const LETHAL = 21;

export function CommanderDamageMatrix({
  view,
  player,
}: {
  view: PlayerView;
  player: PlayerId;
}) {
  const seat = view.seats[player];
  if (!seat) return null;

  const sources = view.seatOrder.filter((p) => p !== player);
  if (sources.length === 0) return null;

  return (
    <div className="flex items-center gap-1" data-cmd-matrix={player}>
      {sources.map((source) => {
        const dealt = seat.cmdDamage[source] ?? 0;
        const lethal = dealt >= LETHAL;
        const near = !lethal && dealt >= LETHAL - 6;
        const initial = view.seats[source]?.name.slice(0, 1).toUpperCase() ?? '?';
        return (
          <span
            key={source}
            data-cmd-from={source}
            data-cmd-amount={dealt}
            data-cmd-lethal={lethal ? '1' : undefined}
            className="crt-num inline-flex items-center gap-[2px] rounded px-1 text-[10px]"
            style={{
              // A zero chip stays present but recedes — see the note in ManaPool
              // about plates that change width.
              color: dealt === 0 ? 'var(--color-crt-faint)' : 'var(--color-crt-text)',
              background: lethal
                ? 'var(--color-crt-cmd)'
                : near
                  ? 'color-mix(in oklab, var(--color-crt-cmd) 30%, transparent)'
                  : 'transparent',
              boxShadow:
                dealt > 0 && !lethal
                  ? 'inset 0 0 0 1px color-mix(in oklab, var(--color-crt-cmd) 60%, transparent)'
                  : 'inset 0 0 0 1px var(--color-crt-border)',
            }}
            title={`${dealt} commander damage from ${view.seats[source]?.name ?? source}${lethal ? ' — lethal' : ''}`}
          >
            <span className="opacity-70">{initial}</span>
            {dealt}
          </span>
        );
      })}
    </div>
  );
}
