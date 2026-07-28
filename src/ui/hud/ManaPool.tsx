import { MANA_SYMBOLS, type ManaSymbol } from '../../view/types';

// The six mana wells. One of the exactly-five places the MTG colours may appear.
//
// A well is drawn even at zero, deliberately: a pool whose wells appear and vanish
// makes the plate's width jump every time you tap a land, and a jumping plate is
// far more distracting than five dim circles.

const WELL_COLOR: Record<ManaSymbol, string> = {
  W: 'var(--color-mtg-w)',
  U: 'var(--color-mtg-u)',
  B: 'var(--color-mtg-b)',
  R: 'var(--color-mtg-r)',
  G: 'var(--color-mtg-g)',
  C: 'var(--color-mtg-c)',
};

export function ManaPool({
  pool,
  size = 14,
}: {
  pool: Record<ManaSymbol, number>;
  size?: number;
}) {
  const total = MANA_SYMBOLS.reduce((n, s) => n + (pool[s] ?? 0), 0);

  return (
    <div
      className="flex items-center gap-[3px]"
      data-mana-total={total}
      aria-label={
        total === 0
          ? 'Mana pool empty'
          : `Mana pool: ${MANA_SYMBOLS.filter((s) => pool[s] > 0).map((s) => `${pool[s]} ${s}`).join(', ')}`
      }
    >
      {MANA_SYMBOLS.map((symbol) => {
        const n = pool[symbol] ?? 0;
        return (
          <span
            key={symbol}
            data-mana={symbol}
            data-mana-count={n}
            className="crt-num inline-flex items-center justify-center rounded-full"
            style={{
              width: size,
              height: size,
              fontSize: size * 0.64,
              lineHeight: 1,
              // An empty well is a dim outline; a full one is filled and dark-texted.
              background: n > 0 ? WELL_COLOR[symbol] : 'transparent',
              color: n > 0 ? 'var(--color-crt-void)' : 'var(--color-crt-faint)',
              boxShadow: `inset 0 0 0 1px ${n > 0 ? 'transparent' : 'var(--color-crt-border)'}`,
              transition: 'background var(--crt-dur) linear, color var(--crt-dur) linear',
            }}
            aria-hidden
          >
            {n > 0 ? n : ''}
          </span>
        );
      })}
    </div>
  );
}
