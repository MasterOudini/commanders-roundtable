import { ManaCost } from './ManaCost';
import { identityToken, type CardData, type CardFace } from '../../data/cardTypes';

// What a card looks like before (or without) its downloaded art.
//
// This is a first-class render path, not an error state. A guest who joins with a
// cold image cache plays a whole game on these, and someone playing offline after
// a card-database sync but before an art prefetch sees them too. So it carries
// everything needed to actually play the card: name, cost, type line, and P/T.
//
// ⚠️ Never replace this with a spinner or an empty box. "The card is there but I
// cannot read it" is a broken game; "the card is there in plain type" is a
// playable one.

interface SyntheticFaceProps {
  card: CardData;
  face: CardFace;
  /** Rendered card height in CSS px — drives which elements fit. */
  height: number;
  /** Show the loading shimmer (art is on its way) vs. a static face (it isn't). */
  pending?: boolean;
}

export function SyntheticFace({ card, face, height, pending = false }: SyntheticFaceProps) {
  const tint = identityToken(card.colorIdentity);
  const compact = height < 190;
  const showText = height >= 150;

  return (
    <div
      className="relative flex h-full w-full flex-col overflow-hidden rounded-[4.5%]"
      style={{
        // A colour-identity wash so the card is identifiable at a glance even
        // before you read the name — the same cue the real frame gives.
        background: `linear-gradient(160deg,
          color-mix(in oklab, ${tint} 22%, var(--color-crt-inset)),
          var(--color-crt-inset) 62%,
          color-mix(in oklab, ${tint} 12%, var(--color-crt-void)))`,
        // A card must read as a discrete physical object. The identity tint alone
        // is too dark to separate a black/red card from the near-black table, so
        // the silhouette comes from a neutral inner edge plus a cast shadow —
        // the tint then sits on top as a hint rather than doing the work.
        boxShadow: [
          'inset 0 0 0 1px var(--color-crt-border-hi)',
          `inset 0 0 0 2px color-mix(in oklab, ${tint} 30%, transparent)`,
          '0 2px 6px oklch(0 0 0 / 0.5)',
        ].join(', '),
      }}
      data-synthetic-face="1"
    >
      <div
        className="flex items-start gap-1 px-[6%] pt-[4%]"
        style={{ minHeight: compact ? undefined : '18%' }}
      >
        <span
          className="font-display leading-tight"
          style={{
            fontSize: Math.max(8, Math.round(height * 0.062)),
            // Two lines at most; a long name ellipsizes rather than pushing the
            // type line off the card.
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
          }}
        >
          {face.name}
        </span>
        {face.manaCost && (
          <ManaCost cost={face.manaCost} size={Math.max(7, Math.round(height * 0.055))} />
        )}
      </div>

      <div
        className="font-sc px-[6%] text-crt-dim"
        style={{ fontSize: Math.max(7, Math.round(height * 0.045)) }}
      >
        {face.typeLine}
      </div>

      {showText && face.oracleText && (
        <div
          className="font-rules mt-[3%] flex-1 overflow-hidden px-[6%] text-crt-dim/90"
          style={{ fontSize: Math.max(7, Math.round(height * 0.042)), lineHeight: 1.25 }}
        >
          {face.oracleText}
        </div>
      )}

      {/* ⚠️ No power/toughness here. Card's chrome layer always draws it, and it
        * draws the CURRENT value (counters, continuous effects) rather than the
        * printed one. Rendering it in both places put two identical elements at
        * the same coordinates — invisible at hand size, an obvious overlap in the
        * zoom panel. Loyalty and defense are chrome's job too. */}

      {pending && (
        // Only background-position animates, so this composites on the GPU and
        // costs nothing even with 40 of them on screen.
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            mixBlendMode: 'screen',
            background:
              'linear-gradient(105deg, transparent 38%, oklch(1 0 0 / 0.14) 50%, transparent 62%)',
            backgroundSize: '260% 100%',
            animation: 'crt-shimmer 1600ms var(--crt-ease-in-out) infinite',
          }}
        />
      )}
    </div>
  );
}
