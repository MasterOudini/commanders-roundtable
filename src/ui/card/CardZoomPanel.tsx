import { useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { Card } from './Card';
import { ManaCost } from './ManaCost';
import { identityToken, type CardData } from '../../data/cardTypes';
import { tier3NotesFor } from '../../data/tier3';

// Hover zoom: the full card at a readable size with complete oracle text.
//
// Oracle text is rendered as real DOM text in a serif face, not scaled-up card
// art — it must be legible and selectable-by-assistive-tech at any card size,
// which is the main reason this app renders cards as DOM rather than in a canvas.

interface CardZoomPanelProps {
  card: CardData;
  /** Panel height in px; the card inside is sized from it. */
  height?: number;
  className?: string;
}

export function CardZoomPanel({ card, height = 620, className = '' }: CardZoomPanelProps) {
  const [faceIndex, setFaceIndex] = useState(0);
  const face = card.faces[faceIndex] ?? card.faces[0]!;
  const tint = identityToken(card.colorIdentity);
  const multiFace = card.faces.length > 1;
  const notes = tier3NotesFor(card, faceIndex);

  return (
    <div
      className={`flex flex-col gap-3 rounded-lg border border-crt-border bg-crt-surface p-3 ${className}`}
      style={{
        width: Math.round(height * 0.72) + 24,
        animation: 'crt-scale-in 140ms var(--crt-ease-out)',
      }}
    >
      <div className="relative self-center">
        <Card card={card} height={height * 0.62} faceIndex={faceIndex} />
        {multiFace && (
          <button
            type="button"
            onClick={() => setFaceIndex((i) => (i + 1) % card.faces.length)}
            className="absolute bottom-1 left-1 flex items-center gap-1 rounded bg-crt-void/85 px-1.5 py-0.5 text-[11px] text-crt-dim transition-colors hover:text-crt-accent-hi"
            // Purely a local peek — it does not transform the permanent. Actual
            // transformation is an engine event.
            title="Look at the other face (does not transform it)"
          >
            <RefreshCw size={11} aria-hidden />
            Other face
          </button>
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        <div className="flex items-baseline gap-2">
          <h3 className="font-display flex-1 text-[15px] leading-tight">{face.name}</h3>
          {face.manaCost && <ManaCost cost={face.manaCost} size={14} />}
        </div>

        <div
          className="font-sc border-b pb-1.5 text-[12px] text-crt-dim"
          style={{ borderColor: `color-mix(in oklab, ${tint} 35%, transparent)` }}
        >
          {face.typeLine}
        </div>

        {face.oracleText && (
          <p className="font-rules whitespace-pre-line text-[13px] leading-snug text-crt-text/95">
            {face.oracleText}
          </p>
        )}

        {face.flavorText && (
          <p className="font-rules whitespace-pre-line text-[12px] italic leading-snug text-crt-faint">
            {face.flavorText}
          </p>
        )}

        {/* ⚠️ The Tier-3 disclosure (D68). A category that is unenforced AND
            unsaid is indistinguishable, from the player's side, from one that is
            enforced and broken — and this is the one place they are already
            reading the card. Silent for a card the engine handles completely,
            which is the common case. */}
        {notes.length > 0 && (
          <div
            className="mt-1 rounded border border-crt-border/70 bg-crt-inset/60 p-2"
            data-tier3={notes.length}
          >
            <p className="font-sc text-[10px] uppercase tracking-wider text-crt-faint">
              This app does not do for you
            </p>
            <ul className="mt-1 space-y-0.5 text-[11px] leading-snug text-crt-dim">
              {notes.map((n) => (
                <li key={n.what}>
                  <span className="text-crt-text">{n.what}</span> — {n.how}
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="mt-1 flex items-center justify-between text-[11px] text-crt-faint">
          <span className="crt-num uppercase">
            {card.setCode} · {card.collectorNumber}
          </span>
          {face.power !== null && (
            <span className="crt-num text-crt-dim">
              {face.power}/{face.toughness}
            </span>
          )}
        </div>

        {face.artist && (
          <div className="text-[10px] text-crt-faint">Illustrated by {face.artist}</div>
        )}
      </div>
    </div>
  );
}
