import { useEffect, useRef } from 'react';
import { Wrench } from 'lucide-react';
import { identityGradient } from '../../data/cardTypes';
import type { LogEntry, PlayerId, PlayerView } from '../../view/types';

// The game log. Newest at the bottom, windowed, with the newest row in a live
// region.
//
// ⚠️ THE LOG IS THE ACCESSIBLE CHANNEL, and it is also the information channel that
// digest mode falls back on. When animations are off — reduced motion, speed Off,
// the table hidden, or the choreographer draining a burst — the log still carries
// the full narrative, so nothing is ever LOST by skipping the motion. That is what
// makes "skip everything" a safe option rather than a lossy one.
//
// Only the newest entry is announced. `aria-live` on the whole list would re-read
// the entire log on every append.
//
// Manual (Tier-3) entries are styled distinctly — wrench glyph, warn colour — so a
// pod can always see what the engine enforced and what a player hand-waved. In a
// friends game that is a trust feature, not decoration.
//
// ⚠️ THE EDGE BAR IS THE PLAYER, NOT THE CARD. It used to be `entry.identity`,
// the colours of the card a line was about — which left most of the log grey,
// because most lines are not about a card at all (turn markers, draws, keeps,
// mulligans, blocks). The one question a four-player log is scanned for is "who
// did that", and it was the one thing the colour did not answer. The bar is that
// seat's commander identity, painted by the same `identityGradient` that draws
// the underline on their nameplate, so a row and the pod it refers to are the
// same colour.

const WINDOW = 200;

export function GameLog({ log, seats }: { log: LogEntry[]; seats: PlayerView['seats'] }) {
  const scroller = useRef<HTMLDivElement | null>(null);
  const rows = log.length > WINDOW ? log.slice(log.length - WINDOW) : log;
  const newest = rows[rows.length - 1];

  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    // Only follow the tail when the reader is already at the bottom, so scrolling
    // back to check what happened is not yanked away by the next event.
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 48;
    if (nearBottom) el.scrollTop = el.scrollHeight;
  }, [log.length]);

  return (
    <div className="flex min-h-0 flex-1 flex-col" data-game-log="">
      <h3 className="font-sc shrink-0 px-2 py-1 text-[10px] tracking-wider text-crt-faint">
        GAME LOG
      </h3>
      <div
        ref={scroller}
        className="min-h-0 flex-1 overflow-y-auto px-1 pb-1"
        // Off-screen rows skip layout and paint entirely.
        style={{ contentVisibility: 'auto' }}
      >
        {rows.length === 0 && (
          <p className="px-1 py-2 text-[11px] text-crt-faint">Nothing has happened yet.</p>
        )}
        {rows.map((entry) => (
          <LogRow key={entry.id} entry={entry} seats={seats} />
        ))}
      </div>
      {/* The live region holds ONLY the newest line. */}
      <div aria-live="polite" className="sr-only" data-log-live="">
        {newest?.text ?? ''}
      </div>
    </div>
  );
}

function LogRow({ entry, seats }: { entry: LogEntry; seats: PlayerView['seats'] }) {
  const identity = seatIdentity(seats, entry.player);
  return (
    <div
      className="relative flex items-start gap-1.5 rounded py-[3px] pl-[7px] pr-1.5 text-[11px] leading-snug"
      data-log-id={entry.id}
      data-log-player={entry.player ?? undefined}
      data-manual={entry.manual ? '1' : undefined}
      style={{
        color: entry.manual ? 'var(--color-crt-warn)' : 'var(--color-crt-dim)',
        background: entry.manual ? 'color-mix(in oklab, var(--color-crt-warn) 8%, transparent)' : undefined,
      }}
    >
      {/* ⚠️ An element, not `border-left`, because a border cannot hold a
          gradient and a two-colour seat has to read as BOTH of its colours. A
          Jeskai player and an Esper player would otherwise both be flat gold —
          `identityToken` collapses every multicolour to one swatch, which is
          right for a card and useless for telling four seats apart.
          ⚠️ The bar stays the PLAYER's even on a manual row. Tier-3 already has
          three signals (wrench, warn text, warn wash); spending the bar on it
          too would cost the only thing that says whose action it was. */}
      <span
        aria-hidden
        className="absolute inset-y-[1px] left-0 w-[3px] rounded-full"
        style={{ background: entry.player ? identityGradient(identity) : 'var(--color-crt-border)' }}
      />
      {entry.manual && <Wrench size={10} className="mt-[2px] shrink-0" aria-hidden />}
      <span>{entry.text}</span>
    </div>
  );
}

/** A seat's commander identity, or nothing for a line that belongs to nobody. */
function seatIdentity(seats: PlayerView['seats'], player: PlayerId | null) {
  return player ? (seats[player]?.identity ?? []) : [];
}
