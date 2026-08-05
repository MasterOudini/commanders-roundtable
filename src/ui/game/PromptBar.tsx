import { useEffect, useMemo, useState } from 'react';
import { ManaCost } from '../card/ManaCost';
import { useTable } from '../../store/tableStore';
import { useGame } from '../../store/gameStore';
import * as session from '../../game/session';
import { BTN, BTN_GHOST, BTN_GHOST_SMALL, BTN_SMALL, PANEL } from './styles';
import { aimPrompt, commitTargets } from './aimCommit';
import { useAim } from '../../store/aimStore';
import type { Awaiting, TargetChoice } from '../../engine/types/state';
import { useLayout } from '../../store/layoutStore';
import { readElements, type FrozenRect } from '../anim/rectRegistry';

interface EffectOffer {
  readonly card: string;
  readonly targets: readonly TargetChoice[];
  readonly name: string;
  readonly lines: readonly string[];
  /**
   * ⚠️ The seat this offer BELONGS to, which is not necessarily the seat being
   * viewed. It is what the intent names, always. See D120.
   */
  readonly controller: string;
}

// The one bar that always says what the game is waiting for and what you can do
// about it.
//
// ⚠️ Copy is written FROM THE PLAYER'S SIDE. "Awaiting declareBlockers from p2"
// is a state dump; "Ana is choosing blockers" is what a person needs. Every
// button says the action, not the mechanism — "Attack with 3", never "Submit".

/** The player on my left: seatOrder is clockwise from me, so index 1. */
function defaultDefenderFor(view: { seatOrder: string[]; seats: Record<string, { lost: boolean }> }, viewer: string) {
  const others = view.seatOrder.filter((p) => p !== viewer && !view.seats[p]?.lost);
  const first = others[0];
  return first ? ({ kind: 'player' as const, id: first }) : null;
}

function nameOf(seats: readonly { id: string; name: string }[], id: string | null): string {
  if (!id) return 'nobody';
  return seats.find((s) => s.id === id)?.name ?? id;
}

function describe(
  awaiting: Awaiting | null,
  priority: string | null,
  seats: readonly { id: string; name: string }[],
  viewer: string,
): string {
  if (awaiting) {
    switch (awaiting.kind) {
      case 'mulligan': {
        const who = awaiting.players.map((p) => nameOf(seats, p)).join(', ');
        return awaiting.players.includes(viewer)
          ? 'Keep this hand, or mulligan.'
          : `Waiting for ${who} to keep or mulligan.`;
      }
      case 'mulliganBottom':
        return awaiting.player === viewer
          ? `Put ${awaiting.count} card${awaiting.count === 1 ? '' : 's'} on the bottom.`
          : `${nameOf(seats, awaiting.player)} is bottoming cards.`;
      case 'declareAttackers':
        return awaiting.player === viewer
          ? 'Choose attackers, or attack with nothing.'
          : `${nameOf(seats, awaiting.player)} is choosing attackers.`;
      case 'declareBlockers': {
        const pending = awaiting.players.filter((p) => !awaiting.submitted.includes(p));
        return pending.includes(viewer)
          ? 'Choose blocks: pick a creature of yours, then drag the arrow onto the attacker it blocks.'
          : `${pending.map((p) => nameOf(seats, p)).join(', ')} choosing blockers.`;
      }
      // ⚠️ These had NO viewer branch, so with the seat that used to be named
      // "You" they read "You is ordering blockers." — the same defect as the
      // log's "You draws a card.", from the same cause. Every other branch in
      // this switch already asks whether the seat is the reader's; these now do
      // too, which is also what lets a seat carry a real name.
      case 'orderBlockers':
        return awaiting.player === viewer
          ? 'Order the creatures blocking your attacker.'
          : `${nameOf(seats, awaiting.player)} is ordering blockers.`;
      case 'orderAttackers':
        return awaiting.player === viewer
          ? 'Order the attackers your blocker is blocking.'
          : `${nameOf(seats, awaiting.player)} is ordering attackers.`;
      case 'orderTriggers':
        return awaiting.player === viewer
          ? 'Choose the order your triggers go on the stack.'
          : `${nameOf(seats, awaiting.player)} is ordering triggers.`;
      case 'chooseLegendKeep':
        return awaiting.player === viewer
          ? `Legend rule: keep one ${awaiting.name}.`
          : `${nameOf(seats, awaiting.player)} is choosing which ${awaiting.name} to keep.`;
      case 'commanderZoneChoice':
        return awaiting.player === viewer
          ? 'Your commander changed zones — put it in the command zone?'
          : `${nameOf(seats, awaiting.player)} is deciding about their commander.`;
      case 'chooseTargets':
        return awaiting.player === viewer
          ? 'Choose targets: drag the arrow onto each one.'
          : `${nameOf(seats, awaiting.player)} is choosing targets.`;
      // ⚠️ A viewer branch from the first line it was written on. Six kinds
      // shipped without one and read "You is ordering blockers." (D101); the
      // cost of remembering is one ternary, and the cost of forgetting is a
      // sentence that has to be found by playing.
      case 'optionalTrigger':
        return awaiting.player === viewer
          ? `${awaiting.label} — this one is optional.`
          : `${nameOf(seats, awaiting.player)} is deciding on a “may” trigger.`;
      // ⚠️ A viewer branch from the first line, like every other kind here.
      // ⚠️ It says WHY there is a choice, because "choose a replacement" reads
      // as a bug to anyone who has not met CR 616. The order genuinely changes
      // the result, and that is the whole reason the game stopped.
      case 'chooseReplacement':
        return awaiting.player === viewer
          ? `Two effects want to change the same thing — which applies first?`
          : `${nameOf(seats, awaiting.player)} is ordering two replacement effects.`;
      case 'chooseColor':
        return awaiting.player === viewer
          ? `${awaiting.label} — name a colour.`
          : `${nameOf(seats, awaiting.player)} is naming a colour for ${awaiting.label}.`;
      case 'entersChoice':
        return awaiting.player === viewer
          ? `${awaiting.label} enters tapped unless you pay ${awaiting.life} life.`
          : `${nameOf(seats, awaiting.player)} is deciding whether to pay for ${awaiting.label}.`;
      // ⚠️ It says HOW MANY and it says CLICK, because this prompt has no
      // buttons — the answer is cards in the hand fan, and a prompt bar that
      // only named the effect would leave the player looking for a control that
      // is not there.
      // ⚠️ TWO ZONES, TWO SENTENCES (D141/D143). "In your hand to discard" is
      // simply wrong for a library peek, where the cards are in a panel and the
      // ones NOT chosen are what leave. A prompt bar that names the wrong place
      // sends the player looking for a control that is not there.
      case 'chooseFromZone':
        if (awaiting.player !== viewer) {
          return awaiting.zone === 'library'
            ? `${nameOf(seats, awaiting.player)} is looking at the top of their library.`
            : `${nameOf(seats, awaiting.player)} is discarding ${awaiting.count}.`;
        }
        return awaiting.zone === 'library'
          ? `${awaiting.label}: click ${awaiting.count} card${awaiting.count === 1 ? '' : 's'} to keep.`
          : `${awaiting.label}: click ${awaiting.count} card${awaiting.count === 1 ? '' : 's'} in your hand to discard.`;
      case 'orderCards':
        return awaiting.player === viewer
          ? `${awaiting.label}: click your ${awaiting.count} cards in the order you want them, ${awaiting.destination} first.`
          : `${nameOf(seats, awaiting.player)} is ordering ${awaiting.count} cards.`;
      case 'rewindVote':
        return awaiting.proposer === viewer
          ? `You proposed rewinding to event ${awaiting.toEventCount}.`
          : `${nameOf(seats, awaiting.proposer)} proposed rewinding to event ${awaiting.toEventCount}.`;
    }
  }
  if (priority === viewer) return 'You have priority.';
  if (priority) return `${nameOf(seats, priority)} has priority.`;
  return 'Thinking…';
}

/**
 * A ring around each card picked so far for a `chooseFromZone` prompt (D137).
 *
 * ⚠️ `data-hand-instance`, NOT `data-band-slot`. `ManaBatchRings` rings
 * BATTLEFIELD permanents and this rings cards in the hand FAN — the same
 * technique against a different selector, because a hand card has no band slot
 * and the query would silently match nothing.
 *
 * ⚠️ Re-measured on the layout epoch and the view, like every other reader
 * of `readElements`: the fan re-poses when a card leaves it, and the hand
 * re-fans under the player mid-pick every time an opponent does anything. A ring
 * left on a card that has moved is worse than no ring at all.
 *
 * ⚠️ `src/ui/table/` is UNCHANGED. This is an overlay measured off the DOM,
 * not a `selected` prop threaded into the fan — which keeps the M2 seam ("the
 * table knows nothing about the engine") intact and fixture mode untouched.
 */
function PickRings({ cards }: { cards: readonly string[] }) {
  const metricsEpoch = useLayout((s) => s.metricsEpoch);
  const view = useGame((s) => s.view);
  const [rects, setRects] = useState<readonly FrozenRect[]>([]);

  useEffect(() => {
    if (cards.length === 0) {
      setRects((prev) => (prev.length === 0 ? prev : []));
      return;
    }
    const els = cards
      .map((id) => document.querySelector(`[data-hand-instance="${id}"]`))
      .filter((el): el is Element => el !== null);
    setRects(readElements(els).filter((r): r is FrozenRect => !!r && r.width > 0));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cards.join(','), metricsEpoch, view]);

  if (rects.length === 0) return null;
  return (
    <div className="pointer-events-none fixed inset-0 z-[1090]" data-pick-rings={rects.length}>
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

export function PromptBar() {
  const { awaiting, legal, viewer, seats, running, finished, winners, message, mode } = useTable();
  const setMode = useTable((s) => s.setMode);
  const setToolsOpen = useTable((s) => s.setToolsOpen);
  const pickOrder = useTable((s) => s.pickOrder);
  const setStopsOpen = useTable((s) => s.setStopsOpen);
  const view = useGame((s) => s.view);
  const priority = view.priority;

  // The last partly-understood spell to resolve, if this app can act for the
  // player who cast it and they have not answered yet. Dropped on the next
  // resolution rather than queued: an offer nobody took is stale the moment the
  // board moves on.
  //
  // ⚠️ THE OFFER BELONGS TO WHOEVER CAST THE SPELL, and the comment here used
  // to say "if it was mine" while nothing checked it. The listener fires on the
  // ACTIVE SEAT'S client, and in a hotseat the table has usually already moved
  // to whoever must respond — so a spell cast by Ben was offered to Ana, and
  // applying it drew Ben's two cards into Ana's hand. See D120.
  //
  // ⚠️ Filtered on `humanSeats()`, not on `viewer`. In a networked game that is
  // the one seat this app speaks for, and the offer reaches only its caster; in
  // a hotseat it is every seat a PERSON is playing, so the offer survives the
  // table changing hands and still applies as the right player.
  //
  // ⚠️ Human seats rather than local ones, because a bot's seat is local too —
  // and being asked to hand-apply half of a card a bot cast is a decision that
  // belongs to nobody at the table. The bot answers its own (it has its own
  // `onBatch` now), and its curated deck cannot contain an assisted card in the
  // first place, which `botPool.node.test.ts` asserts rather than assumes.
  const [offer, setOffer] = useState<EffectOffer | null>(null);
  useEffect(
    () =>
      session.onSpellResolved(({ card, targets, controller }) => {
        if (!session.humanSeats().includes(controller)) {
          setOffer(null);
          return;
        }
        const assisted = session.assistedEffectsFor(card);
        setOffer(assisted ? { card, targets, name: assisted.name, lines: assisted.lines, controller } : null);
      }),
    [],
  );

  const canPass = useMemo(() => legal.some((a) => a.t === 'PassPriority'), [legal]);
  const affordableCasts = useMemo(
    () => legal.filter((a) => a.t === 'CastSpell' && a.affordable).length,
    [legal],
  );

  if (!running) return null;

  const send = (intent: Parameters<typeof session.submit>[0]): void => {
    useTable.getState().setMessage(null);
    session.submit(intent);
  };

  const mine = (kind: Awaiting['kind']): boolean => {
    if (!awaiting || awaiting.kind !== kind) return false;
    if (awaiting.kind === 'mulligan') return awaiting.players.includes(viewer);
    if (awaiting.kind === 'declareBlockers') {
      return awaiting.players.includes(viewer) && !awaiting.submitted.includes(viewer);
    }
    if (awaiting.kind === 'rewindVote') return true;
    return 'player' in awaiting && awaiting.player === viewer;
  };

  return (
    <>
    {awaiting?.kind === 'chooseFromZone' && awaiting.player === viewer && (
      <PickRings cards={pickOrder} />
    )}
    <div
      className={`pointer-events-auto absolute bottom-2 left-1/2 z-[960] flex max-w-[92vw] -translate-x-1/2 items-center gap-2 ${PANEL}`}
      data-prompt-bar=""
    >
      <div className="min-w-[220px] max-w-[420px]">
        {/* ⚠️ Green ONLY for the plain priority case, and it is the same green
            as the phase bar's chip and the nameplate ring — one colour meaning
            "you can act", in all three places it is said. An `awaiting` that is
            mine already names the action in a button beside this text, so
            colouring it too would spend the signal on the case that needs it
            least. */}
        <p
          className={`text-xs ${
            !awaiting && priority === viewer && !finished ? 'text-crt-ok' : 'text-crt-text'
          }`}
          data-prompt-text=""
        >
          {finished
            ? winners.length === 1
              ? `${nameOf(seats, winners[0] ?? null)} wins.`
              : 'The game is a draw.'
            : mode.kind === 'targeting'
              ? aimPrompt(mode)
              : mode.kind === 'attach'
                ? `Where does ${mode.name} go?`
                : mode.kind === 'sacrifice'
                  ? `Choose what ${mode.name} sacrifices`
                  : describe(awaiting, priority, seats, viewer)}
        </p>
        {/* ⚠️ THE HONESTY LINE, and it is not decoration. `tier3.ts` established
            that a category the app does not enforce has to be SAID on the card;
            the same applies to a clause the parser could not read. Saying
            "choose target creature an opponent controls" while cheerfully
            accepting your own Forest would be the app lying about its own
            coverage. When the parser DID read the clause, the prompt above says
            what it read and this line does not appear. */}
        {/* ⚠️ Tier 3, said out loud. `Equip {2}` has no colon, so the ingest never
            reads it as an activated ability and the engine cannot charge it —
            this moves the attachment and nothing else. Calling it "Equip" would
            claim an enforcement that does not exist. */}
        {mode.kind === 'attach' && (
          <p className="mt-0.5 text-[11px] text-crt-faint" data-prompt-attach="">
            Moves it only — the equip cost and its timing are yours.
          </p>
        )}
        {mode.kind === 'targeting' && (mode.specs ?? []).some((s) => s.kinds.length === 0) && (
          <p className="mt-0.5 text-[11px] text-crt-faint" data-prompt-free-aim="">
            Aim at anything — this card&rsquo;s own targeting rule is not checked.
          </p>
        )}
        {message && (
          <p className="mt-0.5 text-[11px] text-crt-warn" data-prompt-error="">
            {message}
          </p>
        )}
      </div>

      {/* ⚠️ The assisted offer. A card whose text the app could only PARTLY read
          never runs by itself — this is the player choosing to apply the part it
          did understand, and the second line says plainly that the rest is
          theirs. It is a notification rather than an `Awaiting`, because a
          partly-understood card must not stop three other people mid-turn. */}
      {offer && (
        <div
          className="min-w-[200px] max-w-[300px] border-l border-crt-border pl-2"
          data-effect-offer={offer.card}
          data-effect-for={offer.controller}
        >
          <p className="text-[11px] text-crt-text">
            {offer.name}: apply “{offer.lines.join(' ')}”?
          </p>
          {/* ⚠️ Says WHOSE when the table has already moved on. The hotseat
              follows priority, so a spell frequently resolves while somebody
              else's board is up, and "apply this" with no name on it is how the
              wrong player ends up drawing the cards. */}
          <p className="mt-0.5 text-[10px] text-crt-faint">
            {offer.controller === viewer
              ? 'The rest of the card is yours.'
              : `For ${seats.find((s) => s.id === offer.controller)?.name ?? offer.controller}, who cast it. The rest of the card is theirs.`}
          </p>
          <div className="mt-1 flex gap-1">
            <button
              type="button"
              className={BTN_SMALL}
              data-action="apply-effect"
              onClick={() => {
                // ⚠️ THE CONTROLLER, never `viewer`. This named the viewer, and
                // the engine builds its synthetic stack object from whatever the
                // intent says — so "draw two cards" drew them for whoever
                // happened to be looking. See D120.
                send({
                  t: 'ManualApplyEffect',
                  player: offer.controller,
                  card: offer.card,
                  targets: offer.targets,
                });
                setOffer(null);
              }}
            >
              Apply
            </button>
            <button
              type="button"
              className={BTN_GHOST_SMALL}
              data-action="dismiss-effect"
              onClick={() => setOffer(null)}
            >
              I&rsquo;ll do it
            </button>
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-1.5">
        {/* ⚠️ The Done button is what makes "up to N" finishable — with `min: 0`
            it is there from the first frame, because casting Fireball at nothing
            is a legal thing to want. At `chosen === max` the aim commits on its
            own, which is Arena's behaviour and the overwhelmingly common case. */}
        {mode.kind === 'targeting' && mode.chosen.length >= mode.min && mode.chosen.length < mode.max && (
          <button
            type="button"
            className={BTN}
            data-action="confirm-targets"
            onClick={() => commitTargets()}
          >
            {mode.chosen.length === 0 ? `Cast ${mode.name} with no targets` : 'Done'}
          </button>
        )}
        {mode.kind === 'targeting' && (
          <button
            type="button"
            className={BTN_GHOST}
            data-action="cancel-targets"
            onClick={() => useTable.getState().escape()}
          >
            Cancel
          </button>
        )}

        {/* ⚠️ Two buttons, because a "may" trigger has exactly two answers and
            BOTH are real: declining is the outcome the card offers and the one
            the engine could not produce before D128. Neither is a default and
            neither is hidden behind a menu. "Do it" says the action rather than
            the mechanism; the prompt text above carries the card's own label,
            which is the only thing that knows what "it" is. */}
        {/* ⚠️ CR 614.12 — five buttons, always, because the answer is a colour and
            not a board object: every one of them is legal on every board. Drawn
            in mana glyphs, which is what the five colours mean everywhere else
            in this app. */}
        {/* ⚠️ One button per applicable effect, labelled with the ability's
            PRINTED TEXT — two copies of the same card are indistinguishable by
            name, and the key is an instance id nobody can read. */}
        {awaiting?.kind === 'chooseReplacement' && mine('chooseReplacement') && (
          <>
            {awaiting.options.map((o) => (
              <button
                key={o.key}
                type="button"
                className={BTN}
                data-action={`choose-replacement`}
                data-replacement-key={o.key}
                onClick={() => send({ t: 'AnswerChooseReplacement', player: viewer, key: o.key })}
              >
                {o.label}
              </button>
            ))}
          </>
        )}
        {awaiting?.kind === 'chooseColor' && mine('chooseColor') && (
          <>
            {(['W', 'U', 'B', 'R', 'G'] as const).map((c) => (
              <button
                key={c}
                type="button"
                className={BTN}
                data-action={`choose-color-${c}`}
                onClick={() => send({ t: 'AnswerChooseColor', player: viewer, color: c })}
              >
                <ManaCost cost={`{${c}}`} />
              </button>
            ))}
          </>
        )}
        {awaiting?.kind === 'optionalTrigger' && mine('optionalTrigger') && (
          <>
            <button
              type="button"
              className={BTN}
              data-action="take-optional-trigger"
              onClick={() =>
                send({
                  t: 'AnswerOptionalTrigger',
                  player: viewer,
                  stackId: awaiting.stackId,
                  accept: true,
                })
              }
            >
              Do it
            </button>
            <button
              type="button"
              className={BTN_GHOST}
              data-action="decline-optional-trigger"
              onClick={() =>
                send({
                  t: 'AnswerOptionalTrigger',
                  player: viewer,
                  stackId: awaiting.stackId,
                  accept: false,
                })
              }
            >
              Decline
            </button>
          </>
        )}

        {/* ⚠️ Both buttons SAY THE PRICE, because that is the whole decision —
            "Yes"/"No" would make the player look back up at the prompt text to
            find out what yes costs. Declining is a full button and not a
            dismissal: entering tapped is a legitimate line, routinely the right
            one, and hiding it would make the expensive answer the easy one. */}
        {awaiting?.kind === 'entersChoice' && mine('entersChoice') && (
          <>
            <button
              type="button"
              className={BTN}
              data-action="pay-enters-choice"
              onClick={() =>
                send({ t: 'AnswerEntersChoice', player: viewer, source: awaiting.source, pay: true })
              }
            >
              Pay {awaiting.life} life
            </button>
            <button
              type="button"
              className={BTN_GHOST}
              data-action="decline-enters-choice"
              onClick={() =>
                send({ t: 'AnswerEntersChoice', player: viewer, source: awaiting.source, pay: false })
              }
            >
              Enter tapped
            </button>
          </>
        )}

        {mine('mulligan') && (
          <>
            <button
              type="button"
              className={BTN}
              data-action="keep"
              onClick={() => send({ t: 'MulliganDecision', player: viewer, keep: true })}
            >
              Keep
            </button>
            <button
              type="button"
              className={BTN_GHOST}
              data-action="mulligan"
              onClick={() => send({ t: 'MulliganDecision', player: viewer, keep: false })}
            >
              Mulligan
            </button>
          </>
        )}

        {/* Pick the defender, then arm creatures — the spec's model, and the
            one that keeps the common case (everyone at one player) to a single
            click. Re-clicking a chip also re-points every attacker already
            armed, so changing your mind costs one click rather than five. */}
        {mode.kind === 'attackers' &&
          view.seatOrder
            .filter((p) => p !== viewer && !view.seats[p]?.lost)
            .map((p) => {
              const isDefault = mode.defaultDefender?.kind === 'player' && mode.defaultDefender.id === p;
              return (
                <button
                  key={p}
                  type="button"
                  className={isDefault ? BTN_SMALL : BTN_GHOST_SMALL}
                  data-action={`defender-${p}`}
                  onClick={() =>
                    setMode({
                      ...mode,
                      defaultDefender: { kind: 'player' as const, id: p },
                      chosen: mode.chosen.map((a) => ({
                        ...a,
                        defender: { kind: 'player' as const, id: p },
                      })),
                    })
                  }
                >
                  {nameOf(seats, p)}
                </button>
              );
            })}

        {mine('declareAttackers') && (
          <>
            {mode.kind !== 'attackers' ? (
              <button
                type="button"
                className={BTN}
                data-action="choose-attackers"
                onClick={() =>
                  setMode({
                    kind: 'attackers',
                    chosen: [],
                    // ⚠️ `seatOrder[1]` — the player on my LEFT, which is the
                    // conventional default at a real table. `seatOrder` is
                    // documented "clockwise around the table, starting at me",
                    // so this is a fact about seating rather than about the
                    // order the seats happen to be listed in.
                    defaultDefender: defaultDefenderFor(view, viewer),
                  })
                }
              >
                Choose attackers
              </button>
            ) : (
              <button
                type="button"
                className={BTN}
                data-action="confirm-attackers"
                onClick={() => {
                  // ⚠️ Each attacker's OWN defender, sent verbatim. This line
                  // used to be `seats.find((s) => s.id !== viewer)` for all of
                  // them, so at three or four players you could not choose whom
                  // you attacked — the engine had accepted a per-attacker
                  // `DefenderRef` since M3 and the UI was throwing it away.
                  send({
                    t: 'DeclareAttackers',
                    player: viewer,
                    attackers: mode.chosen.map((a) => ({ card: a.card, defender: a.defender })),
                  });
                  setMode({ kind: 'idle' });
                }}
              >
                Attack with {mode.chosen.length}
              </button>
            )}
            <button
              type="button"
              className={BTN_GHOST}
              data-action="no-attacks"
              onClick={() => {
                send({ t: 'DeclareAttackers', player: viewer, attackers: [] });
                setMode({ kind: 'idle' });
              }}
            >
              No attacks
            </button>
          </>
        )}

        {mine('declareBlockers') && (
          <>
            {mode.kind !== 'blockers' ? (
              <button
                type="button"
                className={BTN}
                data-action="choose-blockers"
                onClick={() => setMode({ kind: 'blockers', blocks: [], pendingBlocker: null })}
              >
                Choose blocks
              </button>
            ) : (
              <button
                type="button"
                className={BTN}
                data-action="confirm-blockers"
                onClick={() => {
                  send({ t: 'DeclareBlockers', player: viewer, blocks: mode.blocks });
                  useAim.getState().reset();
                  setMode({ kind: 'idle' });
                }}
              >
                Block with {mode.blocks.length}
              </button>
            )}
            <button
              type="button"
              className={BTN_GHOST}
              data-action="no-blocks"
              onClick={() => {
                send({ t: 'DeclareBlockers', player: viewer, blocks: [] });
                setMode({ kind: 'idle' });
              }}
            >
              No blocks
            </button>
          </>
        )}

        {mine('chooseLegendKeep') && awaiting?.kind === 'chooseLegendKeep' && (
          <div className="flex gap-1">
            {awaiting.candidates.map((id, i) => (
              <button
                key={id}
                type="button"
                className={BTN_SMALL}
                data-action="keep-legend"
                onClick={() => send({ t: 'ChooseLegendKeep', player: viewer, keep: id })}
              >
                Keep #{i + 1}
              </button>
            ))}
          </div>
        )}

        {mine('commanderZoneChoice') && (
          <>
            <button
              type="button"
              className={BTN}
              data-action="commander-to-zone"
              onClick={() =>
                send({ t: 'CommanderZoneChoice', player: viewer, toCommandZone: true, always: false })
              }
            >
              To command zone
            </button>
            <button
              type="button"
              className={BTN_GHOST}
              data-action="commander-leave"
              onClick={() =>
                send({ t: 'CommanderZoneChoice', player: viewer, toCommandZone: false, always: false })
              }
            >
              Leave it
            </button>
            <button
              type="button"
              className={BTN_GHOST_SMALL}
              data-action="commander-always"
              onClick={() =>
                send({ t: 'CommanderZoneChoice', player: viewer, toCommandZone: true, always: true })
              }
            >
              Always do this
            </button>
          </>
        )}

        {awaiting?.kind === 'rewindVote' && (
          <>
            <button
              type="button"
              className={BTN}
              data-action="rewind-yes"
              onClick={() => send({ t: 'VoteRewind', player: viewer, agree: true })}
            >
              Agree
            </button>
            <button
              type="button"
              className={BTN_GHOST}
              data-action="rewind-no"
              onClick={() => send({ t: 'VoteRewind', player: viewer, agree: false })}
            >
              Decline
            </button>
          </>
        )}

        {!awaiting && priority === viewer && (
          <button
            type="button"
            className={BTN}
            disabled={!canPass}
            data-action="pass"
            title={affordableCasts > 0 ? `${affordableCasts} spell(s) you can still cast` : undefined}
            onClick={() => send({ t: 'PassPriority', player: viewer })}
          >
            {affordableCasts > 0 ? `Pass (${affordableCasts} playable)` : 'Pass'}
          </button>
        )}

        <button
          type="button"
          className={BTN_GHOST_SMALL}
          data-action="open-tools"
          onClick={() => setToolsOpen(!useTable.getState().toolsOpen)}
        >
          Tools
        </button>
        <button
          type="button"
          className={BTN_GHOST_SMALL}
          data-action="open-stops"
          onClick={() => setStopsOpen(!useTable.getState().stopsOpen)}
        >
          Stops
        </button>
      </div>
    </div>
    </>
  );
}
