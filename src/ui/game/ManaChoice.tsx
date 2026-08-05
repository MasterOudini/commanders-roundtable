import { useEffect, useMemo, useState } from 'react';
import * as session from '../../game/session';
import { useTable } from '../../store/tableStore';
import { useGame } from '../../store/gameStore';
import { useLayout } from '../../store/layoutStore';
import { ManaCost } from '../card/ManaCost';
import { readElements, type FrozenRect } from '../anim/rectRegistry';
import { BTN_SMALL, PANEL } from './styles';
import { canTapOnly, manaOptionsFor, TAP_ONLY, type ManaOption, type TapChoice } from './manaOptions';

// "Which mana?" — the panel a source with more than one thing to give opens,
// and the batch a shift-click builds.
//
// ⚠️ TIER 1. Tapping a land for mana is a rules action the engine performs and
// checks; this is only the choice CR 106.1 has always required the player to
// make and which the app used to make for them, silently, by taking output 0. A
// Tundra could produce nothing but white and a Command Tower nothing but the
// first colour of its identity — for four milestones.
//
// ⚠️ ONE SOURCE AND MANY ARE THE SAME PANEL. `manaChoice.cards` is a list even
// when a plain click put one card in it, because "which mana does this bring"
// and "which mana do these five bring" are the same question at different
// lengths — and a second panel for the batch is how two answers to "what does
// tapping mean" get built.
//
// ⚠️ Everything is recomputed from `legal` on every render rather than captured
// when the panel opened. A source that gets tapped, bounced or killed while this
// is up must stop offering what it can no longer make, and at four players an
// opponent acting mid-decision is entirely ordinary — the same reason
// `AttachmentsPanel` re-reads the view and `GameLayer` re-legalises the veil.

/** One selected card, everything it could bring, and whether it can just turn. */
interface Row {
  readonly card: string;
  readonly label: string;
  readonly options: readonly ManaOption[];
  /** Offer "turn it and nothing else" — mine, on the battlefield, untapped. */
  readonly tapOnly: boolean;
}

export function ManaChoicePanel() {
  const choice = useTable((s) => s.manaChoice);
  const close = useTable((s) => s.closeManaChoice);
  const viewer = useTable((s) => s.viewer);
  const legal = useTable((s) => s.legal);

  /**
   * What each source in the batch was told to make, keyed by card.
   *
   * ⚠️ COMPONENT state, not the store. It is the half-finished answer to one
   * open question and nothing else reads it — and it must die with the panel,
   * which the store's version would not.
   */
  const [picked, setPicked] = useState<Record<string, TapChoice>>({});
  const view = useGame((s) => s.view);

  const rows = useMemo<Row[]>(() => {
    if (!choice) return [];
    return choice.cards.flatMap((card) => {
      const options = manaOptionsFor(legal, card);
      const tapOnly = canTapOnly(view, card, viewer);
      // Nothing to offer at all: it makes no mana and it is not mine to turn.
      if (options.length === 0 && !tapOnly) return [];
      const action = legal.find((a) => a.t === 'TapForMana' && a.card === card);
      const label = action?.t === 'TapForMana'
        ? action.label
        : (view.cards[card]?.card?.name ?? 'This permanent');
      return [{ card, label, options, tapOnly }];
    });
  }, [choice, legal, view, viewer]);

  // ⚠️ Forget a card's pick the moment it leaves the batch, or shift-clicking a
  // land off and back on again silently re-uses the colour chosen last time —
  // a decision the player is not being shown.
  useEffect(() => {
    const live = new Set(rows.map((r) => r.card));
    setPicked((prev) => {
      const next = Object.fromEntries(Object.entries(prev).filter(([card]) => live.has(card)));
      return Object.keys(next).length === Object.keys(prev).length ? prev : next;
    });
  }, [rows]);

  if (!choice || rows.length === 0) return null;

  const batch = rows.length > 1;
  const anyMana = rows.some((r) => r.options.length > 0);
  /**
   * What this row will do, if it is already decided.
   *
   * ⚠️ A source with exactly ONE mana option still defaults to that mana rather
   * than asking — tapping a Forest for green is the most common action in the
   * game and must not grow a click. `Tap only` is an OVERRIDE on it, offered but
   * never required. A card with no mana at all has only the one answer, so it
   * answers itself.
   */
  const chosenFor = (row: Row): TapChoice | undefined => {
    const own = picked[row.card];
    if (own !== undefined) return own;
    if (row.options.length === 1) return row.options[0];
    if (row.options.length === 0) return TAP_ONLY;
    return undefined;
  };
  const ready = rows.every((row) => chosenFor(row) !== undefined);

  const tapForMana = (card: string, option: ManaOption): void => {
    session.submit({
      t: 'TapForMana',
      player: viewer,
      card,
      abilityIndex: option.abilityIndex,
      outputChoice: option.outputChoice,
    });
  };

  const pick = (row: Row, choice: TapChoice): void => {
    useTable.getState().setMessage(null);
    // ⚠️ ONE source commits on the pick — there is nothing to batch, and making
    // a single land cost a second click to confirm would be a step backwards
    // from what a plain click already did.
    if (!batch) {
      if (choice === TAP_ONLY) {
        session.submit({ t: 'ManualSetTapped', player: viewer, cards: [row.card], tapped: true });
      } else {
        tapForMana(row.card, choice);
      }
      close();
      return;
    }
    setPicked((prev) => ({ ...prev, [row.card]: choice }));
  };

  const commit = (): void => {
    if (!ready) return;
    useTable.getState().setMessage(null);
    // ⚠️ One `TapForMana` per source, in the order they were picked up. The
    // engine has no "tap these five" mana intent and should not grow one: each
    // is its own rules action, its own event on the log, and any one of them may
    // be refused without taking the others down with it.
    //
    // ⚠️ The tap-only ones go in ONE `ManualSetTapped`, because that intent does
    // take a list and they are one Tier-3 gesture — so the log reads "You tap 3
    // permanents." with a single wrench rather than three identical lines.
    const turnOnly: string[] = [];
    for (const row of rows) {
      const choice = chosenFor(row);
      if (choice === undefined) continue;
      if (choice === TAP_ONLY) turnOnly.push(row.card);
      else tapForMana(row.card, choice);
    }
    if (turnOnly.length > 0) {
      session.submit({ t: 'ManualSetTapped', player: viewer, cards: turnOnly, tapped: true });
    }
    close();
  };

  /** What the batch will put in the pool, as one cost string. */
  const total = rows
    .map((r) => {
      const c = chosenFor(r);
      return c === undefined || c === TAP_ONLY ? '' : c.cost;
    })
    .join('');

  return (
    <>
    <ManaBatchRings cards={rows.map((r) => r.card)} />
    <div
      // ⚠️ FIXED, not absolute. The anchor is a card's rect, which is in VIEWPORT
      // coordinates, while this panel's positioned ancestor is the screen slot —
      // which starts below the app header. Absolute drew the whole panel 49 px
      // low, by exactly the header's height, on every card on the table.
      // (`CardMenu` and `AttachmentsPanel` place themselves the same way from
      // `clientX`/`clientY` and carry the same offset; they are not touched
      // here.) Nothing between this and the document creates a containing block —
      // `PlayerPod`'s `contain: layout paint` is not an ancestor of the overlay.
      className={`fixed z-[1100] ${batch ? 'w-[228px]' : 'w-[176px]'} ${PANEL}`}
      style={{
        left: Math.min(choice.x, window.innerWidth - (batch ? 238 : 186)),
        top: Math.min(choice.y, window.innerHeight - 130 - (batch ? rows.length * 46 : 0)),
      }}
      data-mana-choice={rows.map((r) => r.card).join(',')}
      data-mana-sources={rows.length}
      data-mana-ready={ready ? '1' : '0'}
    >
      <div className="flex items-baseline justify-between gap-2">
        <p className="truncate font-sc text-[11px] tracking-wider text-crt-text">
          {batch ? `${rows.length} ${anyMana ? 'sources' : 'permanents'}` : rows[0]?.label}
        </p>
        <button
          type="button"
          className="text-[11px] text-crt-faint hover:text-crt-text"
          onClick={close}
          aria-label="Cancel"
        >
          ✕
        </button>
      </div>
      <p className="mt-0.5 text-[10px] leading-snug text-crt-faint">
        {/* The question is whatever the cards can actually answer. A creature
            has no mana to choose between, and asking "which mana?" over a
            single Tap button is the kind of small lie that makes an interface
            feel untrustworthy. */}
        {anyMana
          ? (batch ? 'Which mana from each?' : 'Which mana?')
          : (batch ? 'Turn them?' : 'Turn it?')}
        {!batch && <> · shift-click more to add them</>}
      </p>

      {rows.map((row) => (
        <div key={row.card} className={batch ? 'mt-2 border-t border-crt-border pt-1.5' : 'mt-2'}>
          {batch && (
            <p className="truncate text-[10px] leading-tight text-crt-dim" data-mana-row={row.card}>
              {row.label}
            </p>
          )}
          <div className="mt-1 flex flex-wrap gap-1">
            {row.options.map((option) => {
              const chosen = chosenFor(row) === option;
              return (
                <button
                  key={`${option.abilityIndex}:${option.outputChoice}`}
                  type="button"
                  data-mana-option={option.cost}
                  data-mana-card={row.card}
                  data-mana-chosen={chosen ? '1' : undefined}
                  data-mana-restricted={option.conditional ? '1' : undefined}
                  aria-pressed={batch ? chosen : undefined}
                  aria-label={
                    option.conditional ? `Add ${option.cost} — restricted` : `Add ${option.cost}`
                  }
                  // ⚠️ Restricted is drawn by SHAPE — a dashed edge — not by
                  // colour. The five colours are inside these buttons; a coloured
                  // border here would read as a sixth mana pip. Same rule the
                  // refused targeting arrow follows.
                  //
                  // ⚠️ And CHOSEN is the accent ring, which is the one thing that
                  // may be bright here: it says "this is what you picked", not
                  // "this is a colour".
                  className={
                    'inline-flex items-center gap-1 rounded bg-crt-raised px-2 py-1.5 hover:bg-crt-inset '
                    + (option.conditional
                      ? 'border border-dashed border-crt-border-hi '
                      : 'border border-crt-border ')
                    + (chosen ? 'outline outline-2 outline-crt-accent' : 'hover:border-crt-accent')
                  }
                  onClick={() => pick(row, option)}
                >
                  {/* The glyphs ARE the answer — this is the mana-pip place, one
                      of the exactly five where the five colours may appear. */}
                  <ManaCost cost={option.cost} size={15} />
                  {/* A source with one option is being SHOWN, not asked about. */}
                  {row.options.length === 1 && !row.tapOnly && (
                    <span className="text-[9px] text-crt-faint">only</span>
                  )}
                </button>
              );
            })}

            {/* ⚠️ "Just turn it" — the answer that adds nothing. It is a
                different INTENT (`ManualSetTapped`, Tier 3) and so it is a
                different-looking button: words rather than a glyph, because
                every glyph in this panel means "this much mana goes in the
                pool" and one that meant "no mana" would read as a sixth pip. */}
            {row.tapOnly && (
              <button
                type="button"
                data-tap-only={row.card}
                data-mana-chosen={chosenFor(row) === TAP_ONLY ? '1' : undefined}
                aria-pressed={batch ? chosenFor(row) === TAP_ONLY : undefined}
                className={
                  'inline-flex items-center rounded border border-crt-border bg-crt-raised px-2 py-1.5 '
                  + 'text-[11px] text-crt-dim hover:bg-crt-inset '
                  + (chosenFor(row) === TAP_ONLY
                    ? 'outline outline-2 outline-crt-accent'
                    : 'hover:border-crt-accent hover:text-crt-text')
                }
                onClick={() => pick(row, TAP_ONLY)}
              >
                {row.options.length > 0 ? 'Tap only' : 'Tap'}
              </button>
            )}
          </div>
        </div>
      ))}

      {batch && (
        <div className="mt-2 flex items-center justify-between gap-2 border-t border-crt-border pt-2">
          <span className="flex min-w-0 items-center gap-1 text-[10px] text-crt-faint">
            {ready ? <ManaCost cost={total} size={13} /> : `${rows.filter((r) => !chosenFor(r)).length} left`}
          </span>
          <button
            type="button"
            className={BTN_SMALL}
            data-mana-commit=""
            disabled={!ready}
            onClick={commit}
          >
            Tap {rows.length}
          </button>
        </div>
      )}

      {rows.some((r) => r.options.some((o) => o.conditional)) && (
        // ⚠️ Said, not hidden. The engine excludes this mana from auto-tap; the
        // player has to be told that whatever it could not work out is theirs.
        //
        // ⚠️⚠️ **AND IT USED TO SAY THE WRONG THING, for three cases out of
        // four.** `ManaProduction.conditional` ORs together an activation cost
        // beyond {T}, an activation condition, a spend restriction and an amount
        // the engine cannot compute (D124) — and this line said "the card says
        // what it may be spent on", which is true only of the third. For
        // `Phyrexian Tower` it named a restriction that does not exist while
        // saying nothing about the sacrifice; for `Ancient Tomb` it said nothing
        // about the 2 damage. The honest sentence is the one that does not claim
        // to know which of the four it is.
        <p className="mt-2 border-t border-crt-border pt-1.5 text-[10px] leading-snug text-crt-faint">
          Dashed mana has a catch the app does not handle — a cost beyond
          tapping, a condition, or a limit on what it may be spent on. Read the
          card; that part is yours.
        </p>
      )}
    </div>
    </>
  );
}

/**
 * A ring on every source in the batch.
 *
 * ⚠️ Without it a shift-click that landed and one that missed look identical —
 * the panel gains a row either way, but the row is a name in a list, not the
 * card you are pointing at. This is the only thing that answers "which five did
 * I pick" while you are picking them.
 *
 * ⚠️ Measured through `readElements`, the rectRegistry batch reader, on the same
 * inputs `AimVeil` re-measures on: the selection, the layout epoch, and the view.
 * Nothing taps until the batch is committed, so the board does not move mid-pick
 * — but an opponent acting is entirely ordinary at four players, and a ring left
 * on a card that has moved is worse than no ring.
 */
function ManaBatchRings({ cards }: { cards: readonly string[] }) {
  const metricsEpoch = useLayout((s) => s.metricsEpoch);
  const view = useGame((s) => s.view);
  const [rects, setRects] = useState<readonly FrozenRect[]>([]);

  useEffect(() => {
    if (cards.length === 0) {
      setRects((prev) => (prev.length === 0 ? prev : []));
      return;
    }
    const els = cards
      .map((id) => document.querySelector(`[data-band-slot="${id}"]`))
      .filter((el): el is Element => el !== null);
    setRects(readElements(els).filter((r): r is FrozenRect => !!r && r.width > 0));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cards.join(','), metricsEpoch, view]);

  if (rects.length === 0) return null;

  return (
    <div className="pointer-events-none fixed inset-0 z-[1090]" data-mana-rings={rects.length}>
      {rects.map((rect, i) => (
        <div
          key={i}
          className="absolute rounded-[6px] outline outline-2 outline-crt-accent"
          style={{ left: rect.left, top: rect.top, width: rect.width, height: rect.height }}
        />
      ))}
    </div>
  );
}
