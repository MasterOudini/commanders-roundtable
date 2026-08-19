import * as session from '../../game/session';
import { useTable } from '../../store/tableStore';
import { useGame } from '../../store/gameStore';
import { Card } from '../card/Card';
import { BTN_GHOST_SMALL, BTN_SMALL, PANEL } from './styles';

// The library: scry, surveil, mill, exile — and the panel that shows you what
// you are looking at.
//
// ⚠️ ALL TIER 3. The engine does not know why you are looking at three cards;
// it knows one player revealed the top of their own library to themselves. Scry
// and surveil are the SAME peek followed by different decisions, which is why
// the mode lives in the UI store and every decision goes out as the ordinary
// `ManualMoveCard` the card menu already uses. Nothing here teaches the engine a
// rule it does not enforce.
//
// ⚠️ Both panels are `fixed`, for D111's reason: they anchor to viewport rects
// and their positioned ancestor starts below the app header.

/** What each mode does with a card the player is looking at. */
const MODE_COPY = {
  look: { title: 'Looking at the top', hint: 'Put them back, or move them from here.' },
  scry: { title: 'Scry', hint: 'Top or bottom, for each.' },
  surveil: { title: 'Surveil', hint: 'Keep on top, or into the graveyard.' },
} as const;

export function LibraryMenu() {
  const menu = useTable((s) => s.libraryMenu);
  const close = useTable((s) => s.closeLibraryMenu);
  const viewer = useTable((s) => s.viewer);
  const seats = useTable((s) => s.seats);
  const askNumber = useTable((s) => s.askNumber);
  const setPeekMode = useTable((s) => s.setPeekMode);
  const view = useGame((s) => s.view);

  if (!menu) return null;

  const mine = menu.player === viewer;
  const name = seats.find((s) => s.id === menu.player)?.name ?? 'that player';
  const size = view.hiddenCounts[`lib:${menu.player}`] ?? 0;

  const ask = (
    title: string,
    label: string,
    initial: number,
    onSubmit: (n: number) => void,
  ): void => {
    close();
    askNumber({ title, label, initial, min: 1, max: Math.max(1, size), onSubmit });
  };

  const peek = (mode: 'scry' | 'surveil'): void => {
    ask(mode === 'scry' ? 'Scry' : 'Surveil', 'How many cards', mode === 'scry' ? 1 : 1, (count) => {
      useTable.getState().setMessage(null);
      // ⚠️ The MODE is set before the peek lands, so the panel that opens on the
      // next commit already knows which question it is asking.
      setPeekMode(mode);
      session.submit({ t: 'ManualPeekLibrary', player: viewer, count });
    });
  };

  const bulk = (to: 'graveyard' | 'exile'): void => {
    ask(
      to === 'graveyard' ? (mine ? 'Mill' : `Mill ${name}`) : (mine ? 'Exile from the top' : `Exile from ${name}'s library`),
      'How many cards',
      3,
      (count) => {
        useTable.getState().setMessage(null);
        session.submit({ t: 'ManualMoveTopOfLibrary', player: viewer, target: menu.player, count, to });
      },
    );
  };

  return (
    <div
      className={`fixed z-[1100] w-[184px] ${PANEL}`}
      style={{
        left: Math.min(menu.x, window.innerWidth - 194),
        top: Math.min(menu.y, window.innerHeight - 180),
      }}
      data-library-menu={menu.player}
    >
      <div className="flex items-baseline justify-between gap-2">
        <p className="truncate font-sc text-[11px] tracking-wider text-crt-text">
          {mine ? 'Your library' : `${name}'s library`}
        </p>
        <button
          type="button"
          className="text-[11px] text-crt-faint hover:text-crt-text"
          onClick={close}
          aria-label="Close"
        >
          ✕
        </button>
      </div>
      <p className="mt-0.5 text-[10px] text-crt-faint">{size} cards</p>

      <div className="mt-2 flex flex-wrap gap-1">
        {/* ⚠️ Scry and surveil are about YOUR OWN library and nobody else's —
            you cannot look at an opponent's cards and put them back. Milling and
            exiling from the top ARE things you do to another player, and the
            intent has taken a target since it was written. */}
        {mine && (
          <>
            <button type="button" className={BTN_SMALL} data-library-action="scry" onClick={() => peek('scry')}>
              Scry…
            </button>
            <button type="button" className={BTN_SMALL} data-library-action="surveil" onClick={() => peek('surveil')}>
              Surveil…
            </button>
          </>
        )}
        <button type="button" className={BTN_GHOST_SMALL} data-library-action="mill" onClick={() => bulk('graveyard')}>
          Mill…
        </button>
        <button type="button" className={BTN_GHOST_SMALL} data-library-action="exile" onClick={() => bulk('exile')}>
          Exile…
        </button>
        {mine && (
          <button
            type="button"
            className={BTN_GHOST_SMALL}
            data-library-action="look"
            onClick={() =>
              ask('Look at the top of your library', 'How many cards', 1, (count) => {
                useTable.getState().setMessage(null);
                setPeekMode('look');
                session.submit({ t: 'ManualPeekLibrary', player: viewer, count });
              })
            }
          >
            Look…
          </button>
        )}
      </div>

      <p className="mt-2 border-t border-crt-border pt-1.5 text-[10px] leading-snug text-crt-faint">
        None of this is enforced — every use is marked in the log with a wrench.
      </p>
    </div>
  );
}

/**
 * The cards I am looking at off the top of my own library.
 *
 * ⚠️ It is driven by `view.peek` and nothing else, so it opens for ANY peek —
 * including the tools drawer's "Look at top…" — and closes when the last card
 * has been dealt with. There is no "am I in a scry" flag deciding whether to
 * render: a card revealed to me out of my own library is a card I am looking at.
 *
 * ⚠️ Each decision goes out as its own `ManualMoveCard` the moment it is taken,
 * and the row disappears because the move CLEARS the reveal. So the panel always
 * shows exactly what is left to decide, and the cards left when you press Done
 * are the ones staying on top — in the order they were already in.
 */
export function PeekPanel() {
  const mode = useTable((s) => s.peekMode);
  const viewer = useTable((s) => s.viewer);
  const awaiting = useTable((s) => s.awaiting);
  const pickOrder = useTable((s) => s.pickOrder);
  const view = useGame((s) => s.view);
  const peek = view.peek;

  /**
   * ⚠️ **THE RULES CAN BE ASKING ABOUT THESE CARDS, and that changes what a
   * click means** (D143). The panel was built for the Tier-3 tools, where every
   * button is a `ManualMoveCard` taken immediately. When a `chooseFromZone`
   * (D141) or `orderCards` (D142) prompt is up over this library, those moves
   * are the WRONG action twice over: they bypass the prompt the engine is
   * waiting on, and they are Tier-3 wrenches on the log for something the rules
   * are doing.
   *
   * So a live prompt takes the panel over: the per-card buttons go away and
   * clicking a card adds it to the answer instead.
   */
  const prompt =
    awaiting?.kind === 'chooseFromZone' && awaiting.player === viewer && awaiting.zone === 'library'
      ? ({ kind: 'pick', count: awaiting.count, label: awaiting.label } as const)
      : awaiting?.kind === 'orderCards' && awaiting.player === viewer
        ? ({ kind: 'order', count: awaiting.count, label: awaiting.label, to: awaiting.destination } as const)
        : awaiting?.kind === 'scryChoice' && awaiting.player === viewer
          ? ({ kind: 'scry', count: awaiting.count, label: awaiting.label, toGrave: awaiting.toGraveyard } as const)
          : null;

  if (peek.length === 0) return null;

  const send = (intent: Parameters<typeof session.submit>[0]): void => {
    useTable.getState().setMessage(null);
    session.submit(intent);
  };

  const toBottom = (card: string): void =>
    send({ t: 'ManualMoveCard', player: viewer, card, to: { kind: 'library', player: viewer }, placement: 'bottom' });
  const toGraveyard = (card: string): void =>
    send({ t: 'ManualMoveCard', player: viewer, card, to: { kind: 'graveyard', player: viewer } });
  const toHand = (card: string): void =>
    send({ t: 'ManualMoveCard', player: viewer, card, to: { kind: 'hand', player: viewer } });

  /**
   * ⚠️ **APPEND, NEVER TOGGLE-INTO-A-SET.** For a pick the sequence is
   * incidental; for an ordering it IS the answer, so one handler serves both
   * only because it preserves order. Clicking a card already in the list takes
   * it back OUT — and for an ordering that has to renumber everything after it,
   * which falls out of using an array rather than a set.
   *
   * ⚠️ It SENDS on the last card rather than growing a confirm button, which is
   * the "commits on the pick" rule the mana panel (D113) and the discard fan
   * (D137) already follow.
   */
  const clickPrompt = (id: string): void => {
    if (!prompt) return;
    const st = useTable.getState();
    /**
     * ⚠️ A SCRY NEVER AUTO-SENDS (D195): keeping zero and keeping all are both
     * real answers, so "the last click submits" has no last click — the pick
     * list is the KEEP set (top first) and the button below commits it.
     */
    if (prompt.kind === 'scry') {
      st.togglePick(id);
      return;
    }
    if (st.pickOrder.includes(id)) {
      st.togglePick(id);
      return;
    }
    const next = [...st.pickOrder, id];
    if (next.length < prompt.count) {
      st.togglePick(id);
      return;
    }
    send(
      prompt.kind === 'pick'
        ? { t: 'AnswerChooseFromZone', player: viewer, cards: next }
        : { t: 'AnswerOrderCards', player: viewer, cards: next },
    );
    st.clearPick();
  };

  const submitScry = (): void => {
    if (prompt?.kind !== 'scry') return;
    const st = useTable.getState();
    const keep = st.pickOrder;
    send({
      t: 'AnswerScry',
      player: viewer,
      toTop: keep,
      toBottom: peek.filter((id) => !keep.includes(id)),
    });
    st.clearPick();
  };

  const copy = MODE_COPY[mode];

  return (
    <div
      className={`fixed left-1/2 top-20 z-[1150] w-[420px] -translate-x-1/2 ${PANEL}`}
      data-peek-panel={peek.length}
      // ⚠️ `prompt` when the RULES own this panel, not the Tier-3 mode
      // underneath it — which is stale the moment a prompt takes over and would
      // have a probe reading "scry" off a panel that is answering an ordering.
      data-peek-mode={prompt ? 'prompt' : mode}
    >
      <div className="flex items-baseline justify-between gap-2">
        <p className="font-sc text-xs tracking-wider text-crt-text">
          {prompt ? prompt.label : copy.title} · {peek.length} card{peek.length === 1 ? '' : 's'}
        </p>
        {/* ⚠️ NO "DONE" WHILE A PROMPT IS UP. `ManualStopPeeking` clears the
            reveal without answering, which leaves the engine waiting on a
            question about cards the player can no longer see — a wedge with a
            button on it. The prompt has to be answered.
            ⚠️ The scry SUBMIT below is not that Done: it ANSWERS the prompt
            (keep-zero and keep-all are both real answers, so no click can be
            "the last one" and a commit button is the only honest control). */}
        {prompt?.kind === 'scry' && (
          <button type="button" className={BTN_SMALL} data-peek-scry-submit="" onClick={submitScry}>
            Keep {pickOrder.length}, rest to {prompt.toGrave ? 'graveyard' : 'bottom'}
          </button>
        )}
        {!prompt && (
        <button
          type="button"
          className={BTN_SMALL}
          data-peek-done=""
          // ⚠️ "Done" is not a cancel: whatever is still here STAYS ON TOP, in
          // this order. It only stops the looking, which is a real event —
          // without it those cards would read as revealed for the rest of the
          // game and the panel would never close.
          onClick={() => send({ t: 'ManualStopPeeking', player: viewer })}
        >
          {mode === 'scry' || mode === 'surveil' ? 'Keep the rest on top' : 'Put them back'}
        </button>
        )}
      </div>
      <p className="mt-0.5 text-[10px] text-crt-faint" data-peek-hint="">
        {prompt === null
          ? `${copy.hint} Topmost first.`
          : prompt.kind === 'pick'
            ? `Click ${prompt.count} card${prompt.count === 1 ? '' : 's'} to keep. ${pickOrder.length}/${prompt.count} chosen.`
            : prompt.kind === 'scry'
              ? `Click the cards to KEEP on top, in draw order; the rest go to the ${prompt.toGrave ? 'graveyard' : 'bottom'}. ${pickOrder.length} kept.`
              : `Click all ${prompt.count} in the order you want them, ${prompt.to} first. ${pickOrder.length}/${prompt.count} chosen.`}
      </p>

      <div className="mt-2 flex gap-2 overflow-x-auto pb-1">
        {peek.map((id, i) => {
          const card = view.cards[id];
          return (
            <div key={id} className="flex w-[92px] shrink-0 flex-col items-center gap-1" data-peek-card={id}>
              <div
                className={`relative ${prompt ? 'cursor-pointer' : ''}`}
                onClick={prompt ? () => clickPrompt(id) : undefined}
                data-peek-pick={prompt ? String(pickOrder.indexOf(id) + 1) : undefined}
              >
                <Card card={card?.card ?? null} height={128} instanceId={id} registerSlot={false} />
                {/* ⚠️ The POSITION, not a tick: for an ordering the number IS
                    the answer, and a tick would show that a card was chosen
                    while hiding the only thing that matters about it. */}
                {prompt && pickOrder.includes(id) && (
                  <span className="crt-num pointer-events-none absolute inset-0 z-10 flex items-center justify-center">
                    <span className="rounded-full bg-crt-accent px-2 py-1 text-[13px] text-crt-on-accent">
                      {pickOrder.indexOf(id) + 1}
                    </span>
                  </span>
                )}
                {/* ⚠️ Clear of the card, not on it: the printed name lives in
                    the top-left corner, and a badge overlapping it obscures the
                    one thing a player reads first. */}
                {i === 0 && (
                  <span className="crt-num pointer-events-none absolute -top-3.5 left-1/2 z-10 -translate-x-1/2 rounded bg-crt-accent px-1 text-[9px] text-crt-on-accent">
                    top
                  </span>
                )}
              </div>
              <div className="flex w-full flex-wrap justify-center gap-1">
                {!prompt && mode === 'scry' && (
                  <button type="button" className={BTN_GHOST_SMALL} data-peek-to="bottom" onClick={() => toBottom(id)}>
                    Bottom
                  </button>
                )}
                {!prompt && mode === 'surveil' && (
                  <button type="button" className={BTN_GHOST_SMALL} data-peek-to="graveyard" onClick={() => toGraveyard(id)}>
                    Graveyard
                  </button>
                )}
                {!prompt && mode === 'look' && (
                  <>
                    <button type="button" className={BTN_GHOST_SMALL} data-peek-to="hand" onClick={() => toHand(id)}>
                      Hand
                    </button>
                    <button type="button" className={BTN_GHOST_SMALL} data-peek-to="bottom" onClick={() => toBottom(id)}>
                      Bottom
                    </button>
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
