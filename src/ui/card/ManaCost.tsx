import { parseManaSymbols } from '../../data/manaSymbols';

// Mana symbols via mana-font (Andrew Gioia; fonts SIL OFL 1.1, code MIT), bundled
// locally — no CDN, per workspace policy.
//
// We import only the icon font's own stylesheet. mana-font also ships MPlantin
// (the card-text face); we never reference it, so no @font-face for it is ever
// activated.

interface ManaCostProps {
  /** Scryfall cost string, e.g. '{3}{W/U}{X}'. */
  cost: string;
  /** Font size in px. The symbols are glyphs, so this is their diameter. */
  size?: number;
  className?: string;
}

export function ManaCost({ cost, size = 13, className = '' }: ManaCostProps) {
  const symbols = parseManaSymbols(cost);
  if (symbols.length === 0) return null;

  return (
    <span
      className={`inline-flex items-center gap-[2px] ${className}`}
      style={{ fontSize: size }}
      // The glyphs carry the meaning; give assistive tech the text instead.
      role="img"
      aria-label={manaCostLabel(cost)}
    >
      {symbols.map((sym, i) => (
        <i
          key={`${sym.className}-${i}`}
          className={`ms ${sym.className} ms-cost ms-shadow`}
          aria-hidden
        />
      ))}
    </span>
  );
}

const SYMBOL_WORDS: Record<string, string> = {
  W: 'white', U: 'blue', B: 'black', R: 'red', G: 'green',
  C: 'colorless', S: 'snow', X: 'X', Y: 'Y', Z: 'Z',
};

/** 'two generic, one blue' rather than a string of braces. */
function manaCostLabel(cost: string): string {
  const parts = cost.match(/\{([^}]+)\}/g);
  if (!parts) return '';
  const words = parts.map((raw) => {
    const inner = raw.slice(1, -1);
    if (/^\d+$/.test(inner)) return `${inner} generic`;
    if (inner.includes('/')) {
      return inner.split('/').map((p) => SYMBOL_WORDS[p] ?? p).join(' or ');
    }
    return SYMBOL_WORDS[inner] ?? inner;
  });
  return `mana cost: ${words.join(', ')}`;
}
