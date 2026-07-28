import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, Crown, Layers, Play, Swords, User } from 'lucide-react';
import { startSolo } from '../../game/solo';
import { seatName } from '../../game/buildGame';
import * as session from '../../game/session';
import { useDecks } from '../../store/deckStore';
import { useSolo, MAX_SEATS, MIN_SEATS } from '../../store/soloStore';
import { useTable } from '../../store/tableStore';
import { useUi } from '../../store/uiStore';
import type { DeckSummary } from '../../types/bridge';
import type { StopPolicy } from '../../engine/types/state';

// Set up a game against yourself: how many at the table, and what each of them
// is playing.
//
// ⚠️ Solo is a HOTSEAT (D42/D43). There is no AI — you take every seat in turn,
// and the app does the rules for all of them. The header says so, because a
// player who expects opponents to act on their own will otherwise read the first
// pass-priority prompt as the game being stuck.
//
// ⚠️ The seat labels come from `seatName()`, the same function the engine seats
// with. A lobby that invented its own names would put "Player 2" on this screen
// and "Ana" on the table.

const PANEL = 'rounded-lg border border-crt-border bg-crt-surface p-4';
const BTN =
  'inline-flex items-center gap-1.5 rounded border border-crt-accent-lo bg-crt-accent px-3.5 py-2 ' +
  'text-sm font-medium text-crt-on-accent transition-colors hover:bg-crt-accent-hi ' +
  'disabled:cursor-not-allowed disabled:opacity-40';
const FIELD =
  'w-full rounded border border-crt-border bg-crt-inset px-2 py-1.5 text-xs text-crt-text ' +
  'outline-none focus:border-crt-accent';
const LABEL = 'mb-1 block text-[11px] uppercase tracking-wider text-crt-faint';

/**
 * The stops the panel opens on, before the engine has told us this player's
 * policy.
 *
 * ⚠️ A copy of the engine's `DEFAULT_STOPS`, deliberately — importing that VALUE
 * would pull `src/engine/types/state` into the UI at runtime, and the whole
 * anti-cheating boundary is that `src/ui/` holds no engine state module. The
 * panel writes through `SetStops`, so the engine stays authoritative and any
 * drift shows the moment the panel is opened.
 */
const DEFAULT_STOPS_FOR_UI: StopPolicy = {
  mode: 'auto',
  alwaysStop: { declareAttackers: true, declareBlockers: true },
  stopOnMyUpkeep: false,
  stopWhenAnyoneCasts: true,
  stopBeforeCombatDamage: true,
  stopWhenIHaveInstantSpeedPlay: true,
  fullControlThisTurn: false,
};

export function SoloScreen() {
  const decks = useDecks((s) => s.decks);
  const refreshDecks = useDecks((s) => s.refresh);
  const { seats, deckIds, setSeats, setDeck, dropMissingDecks } = useSolo();
  const goto = useUi((s) => s.goto);
  const setGameSetup = useTable((s) => s.setGameSetup);
  const running = useTable((s) => s.running);

  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<{ ok: boolean; message: string } | null>(null);

  useEffect(() => { void refreshDecks(); }, [refreshDecks]);
  // A deck deleted since the last visit must not stay picked for a seat.
  useEffect(() => { dropMissingDecks(decks.map((d) => d.id)); }, [decks, dropMissingDecks]);

  const start = useCallback(async () => {
    setBusy(true);
    setStatus({ ok: true, message: 'Shuffling up…' });
    try {
      const result = await startSolo({ seats, deckIds: deckIds.slice(0, seats) });
      setStatus({ ok: result.ok, message: result.message });
      if (result.ok) {
        // ⚠️ The table reads these from the store; it does not start games. A
        // game started here with no tokens handed over would leave the Tier-3
        // "create a token" tool empty for the whole game.
        setGameSetup({ tokens: result.tokens, stops: DEFAULT_STOPS_FOR_UI });
        goto('table');
      }
    } catch (e) {
      setStatus({ ok: false, message: e instanceof Error ? e.message : String(e) });
    } finally {
      setBusy(false);
    }
  }, [seats, deckIds, setGameSetup, goto]);

  const byId = new Map(decks.map((d) => [d.id, d]));

  return (
    <div className="flex-1 overflow-auto p-6" data-screen="solo">
      <div className="mx-auto flex max-w-2xl flex-col gap-4">
        <header className="flex items-start gap-3">
          <Swords size={22} className="mt-1 text-crt-accent" aria-hidden />
          <div>
            <h1 className="font-display text-lg">Play solo</h1>
            <p className="mt-1 text-sm text-crt-dim">
              Pick how many are at the table and what each of them is playing. You take
              every seat yourself, one after another — the app runs the rules, shuffles,
              and passes the turn around.
            </p>
          </div>
        </header>

        {/* ── how many ── */}
        <section className={PANEL}>
          <span className={LABEL}>How many at the table</span>
          <div className="flex gap-2" role="group" aria-label="Number of players">
            {Array.from({ length: MAX_SEATS - MIN_SEATS + 1 }, (_, i) => i + MIN_SEATS).map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setSeats(n)}
                aria-pressed={seats === n}
                data-solo-seats={n}
                className={`crt-num rounded border px-4 py-2 text-sm transition-colors ${
                  seats === n
                    ? 'border-crt-accent bg-crt-accent/15 text-crt-accent-hi'
                    : 'border-crt-border bg-crt-raised text-crt-dim hover:border-crt-border-hi hover:text-crt-text'
                }`}
              >
                {n}
              </button>
            ))}
            <span className="self-center pl-1 text-xs text-crt-faint">
              players
            </span>
          </div>
        </section>

        {/* ── who plays what ── */}
        <section className={PANEL}>
          <span className={LABEL}>Decks</span>
          <div className="flex flex-col gap-2.5">
            {Array.from({ length: seats }, (_, i) => (
              <SeatRow
                key={i}
                index={i}
                decks={decks}
                deck={byId.get(deckIds[i] ?? '') ?? null}
                value={deckIds[i] ?? null}
                onChange={(id) => setDeck(i, id)}
              />
            ))}
          </div>

          {decks.length === 0 && (
            <p className="mt-3 text-xs text-crt-faint">
              You have no decks yet, so every seat gets a starter deck. Import one on the{' '}
              <button
                type="button"
                onClick={() => goto('decks')}
                className="underline decoration-dotted underline-offset-2 hover:text-crt-accent-hi"
              >
                Decks
              </button>{' '}
              screen — a link from Moxfield, Archidekt or TappedOut is enough.
            </p>
          )}
        </section>

        {/* ── go ── */}
        <div className="flex flex-wrap items-center gap-3">
          <button type="button" className={BTN} disabled={busy} onClick={() => void start()} data-solo="start">
            <Play size={15} aria-hidden />
            {busy ? 'Shuffling up…' : 'Start the game'}
          </button>

          {running && (
            <span className="flex items-center gap-1.5 text-xs text-crt-warn">
              <AlertTriangle size={13} aria-hidden />
              This ends the game already in progress.
            </span>
          )}

          {status && (
            <span
              className={`text-xs ${status.ok ? 'text-crt-dim' : 'text-crt-danger'}`}
              data-solo="status"
            >
              {status.message}
            </span>
          )}
        </div>

        {session.isRunning() && (
          <button
            type="button"
            onClick={() => goto('table')}
            className="self-start text-xs text-crt-faint underline decoration-dotted underline-offset-2 hover:text-crt-text"
          >
            Back to the game in progress
          </button>
        )}
      </div>
    </div>
  );
}

function SeatRow({
  index, decks, deck, value, onChange,
}: {
  index: number;
  decks: DeckSummary[];
  deck: DeckSummary | null;
  value: string | null;
  onChange: (deckId: string | null) => void;
}) {
  const isMe = index === 0;
  return (
    <div className="flex flex-wrap items-center gap-2.5" data-solo-seat={index}>
      <span
        className={`flex w-20 shrink-0 items-center gap-1.5 text-sm ${isMe ? 'text-crt-text' : 'text-crt-dim'}`}
      >
        {isMe ? <User size={13} className="text-crt-accent" aria-hidden /> : <Layers size={13} aria-hidden />}
        {seatName(index)}
      </span>

      <select
        className={`${FIELD} max-w-xs flex-1`}
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value === '' ? null : e.target.value)}
        aria-label={`Deck for ${seatName(index)}`}
        data-solo-deck={index}
      >
        <option value="">Starter deck (not a legal Commander deck)</option>
        {decks.map((d) => (
          <option key={d.id} value={d.id}>{d.name}</option>
        ))}
      </select>

      {deck && (
        <span className="flex items-center gap-1.5 text-[11px] text-crt-faint">
          {deck.commanderNames.length > 0 ? (
            <>
              <Crown size={11} className="text-crt-accent" aria-hidden />
              {deck.commanderNames.join(' + ')}
            </>
          ) : (
            // Worth saying here rather than at the table: a deck with no
            // commander starts the game with an empty command zone.
            <>
              <AlertTriangle size={11} className="text-crt-warn" aria-hidden />
              <span className="text-crt-warn">no commander set</span>
            </>
          )}
          <span className="crt-num">· {deck.cardCount} cards</span>
          {deck.houseRuled && <span>· house-ruled</span>}
        </span>
      )}
    </div>
  );
}
