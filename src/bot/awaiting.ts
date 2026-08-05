// An answer for every prompt the game can raise.
//
// ⚠️ THIS FILE IS D102. `simplestIntent` answers 8 of the 13 `Awaiting` kinds
// and falls to `default: return null` for the other five — and a driver that
// returns null submits nothing, ever again, with no error anywhere. That is how
// the two-instance sign-off read 21/24 for weeks: the game was stopped on
// `chooseTargets` with nobody answering, and a wedge looks exactly like a
// healthy idle from outside.
//
// So: a case for every kind, an exhaustiveness check that makes a FOURTEENTH
// kind a compile error rather than a runtime hang, and a `fault` — loud, logged,
// surfaced — wherever no answer exists. Never a bare null.
//
// ⚠️ AND EVERY ANSWER MUST TERMINATE, not merely exist. `chooseTargets` answers
// `CancelPendingCast` when a required clause cannot be filled; on its own that
// converts the deadlock into a LIVELOCK, because `legalActions` never considers
// targets and re-offers the same spell forever. The other half lives in
// `policy.ts`, which refuses to cast a spell whose targets cannot be planned.
// Prevention and recovery, never one alone.

import type { Awaiting, TargetChoice } from '../engine/types/state';
import type { InstanceId, PlayerId } from '../engine/types/ids';
import type { CardView, PlayerView } from '../view/types';
import { parseTypeLine } from '../data/oracleParse';
import { chooseAttacks, chooseBlocks } from './combat';
import { planTargets } from './targets';
import { act, fault, wait, type BotDecision, type BotPort } from './types';

/** The cards in my own hand, which projection always shows me in full. */
function myHand(view: PlayerView, me: PlayerId): CardView[] {
  const out: CardView[] = [];
  for (const id of view.zones[`hand:${me}`] ?? []) {
    const card = view.cards[id];
    if (card) out.push(card);
  }
  return out;
}

function isLand(card: CardView): boolean {
  const face = card.card?.faces[0];
  return face ? parseTypeLine(face.typeLine).types.includes('Land') : false;
}

/**
 * The life total a bot will not pay itself below for an untapped land (D136).
 *
 * ⚠️ A FLOOR, NOT A FRACTION. Paying 2 of 40 and 2 of 6 cost the same and are
 * completely different decisions; a ratio prices them identically. 12 is three
 * shock lands clear of the range where an unanswered attack ends the game, which
 * is the same "survival is a rule, not a weight" reading D126 measured for
 * chump-blocking — trades are priced, not dying is not a trade.
 */
const ENTERS_LIFE_FLOOR = 12;

/** Most expensive first, so bottoming takes the cards a curve cannot use. */
function worstFirst(a: CardView, b: CardView): number {
  const d = (b.card?.cmc ?? 0) - (a.card?.cmc ?? 0);
  return d !== 0 ? d : a.instanceId.localeCompare(b.instanceId);
}

/**
 * Answer the prompt, or say plainly that it is not ours / that we cannot.
 *
 * `attempt > 0` means the previous answer was rejected: give the minimal legal
 * one instead of the same one again.
 */
export function answerAwaiting(
  port: BotPort,
  awaiting: Awaiting,
  me: PlayerId,
  attempt: number,
): BotDecision {
  const view = port.currentView();

  switch (awaiting.kind) {
    /**
     * ⚠️ Mine-check is `players.includes(me) && !submitted.includes(me)`, NOT
     * `players[0] === me`. `simplestIntent` uses the latter and therefore
     * returns null for a seat sitting anywhere but first in the list — which is
     * a wedge for exactly the seats a bot is most likely to occupy.
     */
    case 'mulligan': {
      if (!awaiting.players.includes(me) || awaiting.submitted.includes(me)) {
        return wait('not my mulligan');
      }
      const hand = myHand(view, me);
      const lands = hand.filter(isLand).length;
      // ⚠️ A NARROW BAND ON PURPOSE. Nothing in `PlayerView` says how many
      // mulligans this seat has taken — the hand is seven cards every time under
      // the London rule — so the bot cannot widen its standards as it goes, and
      // a greedy band would be an unbounded loop with no way to see itself. Two
      // to five lands out of seven keeps roughly nine hands in ten.
      const keep = lands >= 2 && lands <= 5;
      return act({ t: 'MulliganDecision', player: me, keep }, keep ? `keep ${lands} lands` : `mulligan ${lands} lands`);
    }

    /**
     * ⚠️ `simplestIntent` AND `simplestAnswer` both return null here. It is a
     * live wedge in the existing drivers, reachable the moment anyone mulligans,
     * and this is the first thing in the project that closes it.
     */
    case 'mulliganBottom': {
      if (awaiting.player !== me) return wait('not my hand');
      const cards = myHand(view, me).sort(worstFirst).slice(0, awaiting.count);
      return act(
        { t: 'MulliganBottom', player: me, cards: cards.map((c) => c.instanceId) },
        `bottom ${cards.length}`,
      );
    }

    case 'declareAttackers': {
      if (awaiting.player !== me) return wait('not my combat');
      // ⚠️ An empty declaration is unconditionally legal, so a second attempt
      // after a rejection can never itself be rejected.
      const attacks = attempt > 0 ? [] : chooseAttacks(view, awaiting, me);
      return act({ t: 'DeclareAttackers', player: me, attackers: attacks }, `attack with ${attacks.length}`);
    }

    case 'declareBlockers': {
      if (!awaiting.players.includes(me) || awaiting.submitted.includes(me)) {
        return wait('not my blocks');
      }
      // ⚠️ The fallback exists for MENACE. "This attacker needs two blockers" is
      // checked across the whole declaration by `validateBlockDeclaration`, not
      // by `canBlock`, so it is not in the pairing list the prompt carries and
      // no client can see it. Declaring nothing is always accepted.
      const blocks = attempt > 0 ? [] : chooseBlocks(view, awaiting, me);
      return act({ t: 'DeclareBlockers', player: me, blocks }, `block ${blocks.length}`);
    }

    /**
     * ⚠️ Unreachable today — nothing in the engine raises it. 11 of the 13 kinds
     * have a producer, and `awaitingProducers.node.test.ts` asserts exactly
     * which, so that is now a checked fact rather than a remembered one. Written
     * and tested against a hand-built prompt anyway, because "no producer" is a
     * fact about today and a missing case is a silent hang forever.
     */
    case 'orderBlockers': {
      if (awaiting.player !== me) return wait('not my order');
      const order = orderedBy(view, (c) => c.blocking.includes(awaiting.attacker));
      return act({ t: 'OrderBlockers', player: me, attacker: awaiting.attacker, order }, `order ${order.length}`);
    }

    /**
     * ⚠️ ANSWERED FROM `CardView.blocking`, WHICH IS WHY IT IS AN ARRAY. This
     * faulted `viewCannotExpressMultiBlock` until D125: the projection kept only
     * `attackerOrder[0]`, so a creature blocking two attackers could name one of
     * them and the list this prompt asks for was literally unsayable. A guess
     * would have put combat damage on the wrong creature.
     *
     * ⚠️ The handler checks `sameSet(decl.attackerOrder, intent.order)` — exactly
     * these attackers, no more and no fewer — so the answer is the view's own
     * list, re-SORTED and never re-derived. Ordering weakest first spends the
     * blocker's power where it kills something.
     */
    case 'orderAttackers': {
      if (awaiting.player !== me) return wait('not my order');
      const blocking = view.cards[awaiting.blocker]?.blocking ?? [];
      const order = orderedBy(view, (c) => blocking.includes(c.instanceId));
      // The prompt names a blocker this client cannot see blocking anything —
      // a projection and a prompt that disagree. Faulting names it; answering
      // with a short list would be rejected as an invalid order anyway.
      if (order.length !== blocking.length || order.length === 0) {
        return fault(
          'viewCannotExpressMultiBlock',
          `the view says ${awaiting.blocker} blocks ${blocking.length} attacker(s) and can place ${order.length}`,
        );
      }
      return act({ t: 'OrderAttackers', player: me, blocker: awaiting.blocker, order }, `order ${order.length}`);
    }

    // Identity is always a valid permutation, and with no card scripts there is
    // nothing here worth reordering.
    case 'orderTriggers':
      return awaiting.player === me
        ? act({ t: 'OrderTriggers', player: me, order: [...awaiting.triggers] }, 'triggers in printed order')
        : wait('not my triggers');

    case 'chooseLegendKeep': {
      if (awaiting.player !== me) return wait('not my legend');
      const keep = orderedBy(view, (c) => awaiting.candidates.includes(c.instanceId), true)[0]
        ?? awaiting.candidates[0];
      if (!keep) return fault('unknownAwaiting', 'a legend prompt with no candidates');
      return act({ t: 'ChooseLegendKeep', player: me, keep }, `keep ${keep}`);
    }

    /**
     * ⚠️ `always: false`, unlike `simplestIntent`'s `true`. "Always do this" is a
     * standing policy the player never chose, and it would silently change every
     * later prompt in the game — and the log. Answering the question in front of
     * us is the smaller, honest move.
     */
    case 'commanderZoneChoice':
      return awaiting.player === me
        ? act({ t: 'CommanderZoneChoice', player: me, toCommandZone: true, always: false }, 'commander to the zone')
        : wait('not my commander');

    // ⚠️ Only reachable when the bot did NOT start this cast: `policy.ts` skips
    // every `hasX` spell. Zero is always legal and always terminates.
    case 'chooseX':
      return awaiting.player === me
        ? act({ t: 'ChooseX', player: me, x: 0 }, 'X = 0')
        : wait('not my X');

    case 'chooseTargets': {
      if (awaiting.player !== me) return wait('not my targets');
      const targets: TargetChoice[] | null =
        attempt > 0 ? null : planTargets(port, awaiting.source, awaiting.specs, view, me);
      // The board can change between choosing to cast and being asked. Cancelling
      // is the terminating answer; returning nothing here is the wedge this case
      // exists to remove.
      return targets
        ? act({ t: 'ChooseTargets', player: me, targets }, `aim at ${targets.length}`)
        : act({ t: 'CancelPendingCast', player: me }, 'no legal targets — abandon the cast');
    }

    /**
     * ⚠️ ACCEPT, and the reason is that the bot cannot price it. A "may" trigger
     * carries a LABEL and nothing else — the effect is a card script, and
     * `src/bot/` may not import an engine module that takes a `GameState`
     * (invariant 3), so there is no honest evaluation available at this seam.
     * What is available is the reason the card is in the deck at all: an
     * optional trigger on your own permanent is written to be worth taking, and
     * a bot that declined every one would play a strictly worse card than the
     * one it drew.
     *
     * ⚠️ IT IS A POLICY, NOT A MEASUREMENT, and it is unreachable today: the
     * bot's deck holds only cards `engineComplete` accepts, and no card with an
     * unrun triggered ability is one (D121 — 0 enchantments, 0 planeswalkers).
     * The first scripted "may" card the bot can hold is the point at which this
     * needs to become a per-card judgement rather than a default, and M6.4 is
     * where the information to make one arrives.
     */
    case 'optionalTrigger':
      return awaiting.player === me
        ? act(
            { t: 'AnswerOptionalTrigger', player: me, stackId: awaiting.stackId, accept: true },
            `take "${awaiting.label}"`,
          )
        : wait('not my trigger');

    /**
     * ⚠️ **THE FIRST PROMPT THE BOT CAN ACTUALLY PRICE**, and the contrast with
     * `optionalTrigger` above is the point. That one carries a label and nothing
     * else, so accepting is a stated policy. This one carries a NUMBER — the
     * life it costs — against a life total the bot can read off its own
     * `PlayerView`, and `eval.ts` is denominated in life-equivalent points
     * precisely so a cost like this can be compared with something.
     *
     * Pay while the payment is not itself dangerous, decline when it is. The
     * threshold is D126's `SAFETY` reasoning one step along: an untapped land is
     * worth about a turn of tempo, and no amount of tempo is worth a life total
     * that lets somebody else's attack finish the job. It is deliberately a
     * FLOOR rather than a ratio — 2 life at 40 and 2 life at 6 are the same
     * price and completely different decisions, and a ratio prices them the same.
     *
     * ⚠️ Reachable today, unlike the trigger above: `Temple Garden` and its nine
     * siblings are `engineComplete` as of D136, so the bot's pool can hold them.
     */
    case 'entersChoice': {
      if (awaiting.player !== me) return wait('not my permanent');
      const life = view.seats[me]?.life ?? 0;
      const pay = life - awaiting.life >= ENTERS_LIFE_FLOOR;
      return act(
        { t: 'AnswerEntersChoice', player: me, source: awaiting.source, pay },
        pay ? `pay ${awaiting.life} for ${awaiting.label}` : `let ${awaiting.label} enter tapped`,
      );
    }

    /**
     * ⚠️ **THE PROMPT SHIPS NO CANDIDATES AND THE BOT DOES NOT NEED THEM** — a
     * hand is hidden, so `Awaiting.chooseFromZone` says only who and how many,
     * and the bot reads its own hand off the `PlayerView` projection already
     * shows it. That is D125's rule holding without a single wire field: a
     * variant needs a client able to COMPUTE the answer, and this one is.
     *
     * ⚠️ It discards the WORST cards by the same `worstFirst` the mulligan
     * bottoming uses — most expensive first, so a curve keeps what it can cast.
     * A crude rule, and the honest ceiling on it is that `CardView` carries mana
     * value and not what a card DOES; pricing a discard properly needs the same
     * per-card judgement M6.4 brings.
     */
    case 'chooseFromZone': {
      if (awaiting.player !== me) return wait('not my choice');
      // WARNING: TWO ZONES (D141). A discard picks the WORST cards out of the
      // hand; a library peek picks the BEST of what was just revealed, because
      // the unchosen go to the graveyard or the bottom. Same prompt, opposite
      // sort — reusing one order would make the bot throw away what it looked
      // for.
      const pool =
        awaiting.zone === 'library'
          ? (view.peek ?? []).map((id) => view.cards[id]).filter((c): c is CardView => !!c)
          : myHand(view, me);
      const ordered =
        awaiting.zone === 'library' ? [...pool].sort(worstFirst).reverse() : [...pool].sort(worstFirst);
      const cards = ordered.slice(0, awaiting.count).map((c) => c.instanceId);
      // Short of the count means the engine asked for more than the hand holds,
      // which it does not do — but answering with fewer is a rejection, and a
      // fault says so where a silent short answer would look like a wedge.
      if (cards.length < awaiting.count) {
        return fault('noIntentForAwaiting', `asked for ${awaiting.count} cards, hand holds ${cards.length}`);
      }
      return act(
        { t: 'AnswerChooseFromZone', player: me, cards },
        `discard ${cards.length} to ${awaiting.label}`,
      );
    }

    /**
     * ⚠️ **BEST CARD NEAREST THE TOP, WORST NEAREST THE BOTTOM** — the one
     * ordering question the bot can answer without pricing anything it cannot
     * see. `worstFirst` is the same comparator the mulligan bottoming uses, run
     * in whichever direction the destination calls for.
     *
     * ⚠️ Its ceiling is `CardView.cmc`: mana value is a poor proxy for what a
     * card DOES, and pricing this properly needs the per-card judgement M6.4
     * brings. Said here rather than dressed up as strategy.
     */
    case 'orderCards': {
      if (awaiting.player !== me) return wait('not my order');
      const shown = (view.peek ?? []).map((id) => view.cards[id]).filter((x): x is CardView => !!x);
      const ordered =
        awaiting.destination === 'top'
          ? [...shown].sort(worstFirst).reverse()
          : [...shown].sort(worstFirst);
      if (ordered.length !== awaiting.count) {
        return fault('noIntentForAwaiting', `asked to order ${awaiting.count}, can see ${ordered.length}`);
      }
      return act(
        { t: 'AnswerOrderCards', player: me, cards: ordered.map((x) => x.instanceId) },
        `order ${ordered.length} to the ${awaiting.destination}`,
      );
    }

    /**
     * ⚠️ Agree. A rewind needs every living player to vote, so a bot that never
     * votes makes rewind impossible for the human — and rewind is the group's
     * answer to a rules mistake, not a negotiation with the opponent.
     */
    case 'rewindVote': {
      if (awaiting.agreed.includes(me) || awaiting.declined.includes(me)) return wait('already voted');
      return act({ t: 'VoteRewind', player: me, agree: true }, 'agree to the rewind');
    }

    /**
     * ⚠️ **A POLICY, AND SAID TO BE ONE** — the same shape as `optionalTrigger`'s
     * accept (D128). The bot cannot know what it will want the mana for: a
     * `PlayerView` carries no future, and `src/bot/` may not import an engine
     * module that takes a `GameState`. So it names the first colour of its own
     * commander identity, which is the only defensible answer available from
     * what it can see, and falls back to green when it has none at all.
     */
    /**
     * ⚠️ **THE FIRST OPTION, AND SAID TO BE A POLICY.** CR 616 order changes
     * outcomes — `Hardened Scales` before `Branching Evolution` is six counters,
     * the other way five — so there IS a best answer and the bot cannot compute
     * it: the options are printed TEXT, and `src/bot/` may not import an engine
     * module that takes a `GameState` to simulate either order. Taking the first
     * is the battlefield-order answer the engine used before D148, which makes
     * this exactly as good as it was and no worse.
     */
    case 'chooseReplacement': {
      const first = awaiting.options[0];
      if (!first) return fault('noIntentForAwaiting', 'asked to order replacements with no options');
      return act({ t: 'AnswerChooseReplacement', player: me, key: first.key }, 'order a replacement');
    }

    case 'chooseColor': {
      const seat = view.seats[me];
      return act(
        { t: 'AnswerChooseColor', player: me, color: seat?.identity[0] ?? 'G' },
        'name a colour',
      );
    }
  }

  // ⚠️ THE REAL GUARD IS THE COMPILE ERROR, not this line: `never` means a
  // fourteenth `Awaiting` kind fails `tsc -b` rather than reaching a table.
  const unreachable: never = awaiting;
  return fault('unknownAwaiting', `no case for ${JSON.stringify(unreachable)}`);
}

/** Battlefield cards matching a predicate, weakest first (or strongest first). */
function orderedBy(
  view: PlayerView,
  match: (card: CardView) => boolean,
  strongestFirst = false,
): InstanceId[] {
  const out: CardView[] = [];
  for (const [zone, ids] of Object.entries(view.zones)) {
    if (!zone.startsWith('bf:') || !ids) continue;
    for (const id of ids) {
      const card = view.cards[id];
      if (card && match(card)) out.push(card);
    }
  }
  const sign = strongestFirst ? -1 : 1;
  return out
    .sort((a, b) => {
      const d = sign * ((a.toughness ?? 0) + (a.power ?? 0) - ((b.toughness ?? 0) + (b.power ?? 0)));
      return d !== 0 ? d : a.instanceId.localeCompare(b.instanceId);
    })
    .map((c) => c.instanceId);
}
