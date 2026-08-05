// What the bot does when it holds priority, and the one entry point above it.
//
// Level 1: play a land, curve out, attack when the trade is good, block to
// survive. That is most of the distance to "feels like a real opponent" and it
// is cheap. An evaluation function and lookahead are M6.2 — and the M6 brief is
// explicit that a rung must be proven to beat the one below it before the next
// is started.

import type { Intent } from '../engine/types/intents';
import type { LegalAction } from '../engine/legal';
import type { CardView, PlayerView } from '../view/types';
import type { PlayerId } from '../engine/types/ids';
import { parseTypeLine } from '../data/oracleParse';
import { answerAwaiting } from './awaiting';
import { planTargets } from './targets';
import { decideRandom } from './random';
import { creatureValue } from './eval';
import { act, wait, type BotConfig, type BotDecision, type BotPort, type BotSnapshot } from './types';

type Cast = Extract<LegalAction, { t: 'CastSpell' }>;
type Land = Extract<LegalAction, { t: 'PlayLand' }>;

function cardOf(view: PlayerView, id: string): CardView | undefined {
  return view.cards[id];
}

/**
 * What casting this would be worth, in the same life-equivalent points
 * `eval.ts` uses.
 *
 * ⚠️ M6.2 changed the question from "what costs the most" to "what is worth the
 * most". Curving out is a good habit and a bad rule: a 6-mana 3/3 and a 4-mana
 * 5/5 are not close, and the old ordering took the 3/3 every time because it
 * cost more. Mana value stays as the TIE-BREAK, which is where "spend your turn"
 * belongs.
 *
 * ⚠️ Read off the PRINTED face rather than `CardView.power`, because a card in
 * hand has not been through `derive` — its live P/T is whatever the projection
 * defaulted to, and the bot would price every creature in its hand at 0/0.
 */
function castValue(view: PlayerView, action: Cast): number {
  const card = cardOf(view, action.card)?.card;
  const face = card?.faces[action.faceIndex] ?? card?.faces[0];
  if (!card || !face) return 0;

  const types = parseTypeLine(face.typeLine).types;
  const mv = Math.max(1, card.cmc);

  if (types.includes('Creature')) {
    // A synthetic view of what this creature WILL be once it lands — printed
    // body, printed keywords, summoning sick. `creatureValue` then prices it the
    // same way it prices everything already on the battlefield, which is what
    // stops casting and combat disagreeing about what a creature is worth.
    const printed: CardView = {
      instanceId: action.card,
      card,
      faceIndex: action.faceIndex,
      faceDown: false,
      controller: view.me,
      owner: view.me,
      tapped: false,
      summoningSick: true,
      damage: 0,
      counters: {},
      power: Number(face.power ?? 0) || 0,
      toughness: Number(face.toughness ?? 0) || 0,
      attachedTo: null,
      isCommander: cardOf(view, action.card)?.isCommander ?? false,
      isToken: false,
      attacking: null,
      blocking: [],
    };
    return creatureValue(printed);
  }

  // ⚠️ Everything else in the bot's pool is removal, a counterspell or a mana
  // rock — there are 148 executable instants, 67 sorceries and 22 artifacts in
  // it and NO enchantments, planeswalkers or battles (D121). Pricing them off
  // mana value is a proxy and is honest about being one; giving each effect kind
  // its own number is the next thing worth measuring, not the next thing worth
  // assuming.
  return mv * 1.5;
}

/**
 * Best first, then most expensive, then by id.
 *
 * ⚠️ The commander still leads when it is castable — it is the best card in the
 * deck by construction and it comes back when it dies, so nothing else competes
 * for the mana.
 */
function castOrder(view: PlayerView, a: Cast, b: Cast): number {
  const ca = cardOf(view, a.card);
  const cb = cardOf(view, b.card);
  const cmd = Number(cb?.isCommander ?? false) - Number(ca?.isCommander ?? false);
  if (cmd !== 0) return cmd;
  const value = castValue(view, b) - castValue(view, a);
  if (Math.abs(value) > 0.001) return value;
  const d = (cb?.card?.cmc ?? 0) - (ca?.card?.cmc ?? 0);
  if (d !== 0) return d;
  return a.card.localeCompare(b.card);
}

/**
 * Which land to play.
 *
 * The one that produces a colour the most stuck cards in hand are asking for,
 * so a two-colour deck does not flood on one side. Ties break on the card id, so
 * the choice is reproducible.
 */
function landOrder(view: PlayerView, me: PlayerId, a: Land, b: Land): number {
  const need: Record<string, number> = {};
  for (const id of view.zones[`hand:${me}`] ?? []) {
    for (const colour of view.cards[id]?.card?.colorIdentity ?? []) {
      need[colour] = (need[colour] ?? 0) + 1;
    }
  }
  const value = (action: Land): number => {
    const card = cardOf(view, action.card);
    let s = 0;
    for (const colour of card?.card?.colorIdentity ?? []) s += need[colour] ?? 0;
    // A land with no colour identity still fixes nothing; prefer a coloured one
    // when the hand needs colours, and take it otherwise.
    return s;
  };
  const d = value(b) - value(a);
  return d !== 0 ? d : a.card.localeCompare(b.card);
}

function isSorcerySpeedWindow(snapshot: BotSnapshot, view: PlayerView): boolean {
  return snapshot.turn.active === snapshot.you && view.stack.length === 0;
}

/**
 * What to do with priority.
 *
 * ⚠️ Level 1 acts only on its OWN turn with an empty stack. Deciding whether a
 * held instant is worth a window means reading effect text against a board,
 * which is level 2's job; passing is the honest answer until then, and it stops
 * the bot dumping its hand into its own upkeep. It is also why `BOT_STOPS` turns
 * the instant-speed refinements off — the policy would only ever pass in them.
 */
function priorityAction(port: BotPort, snapshot: BotSnapshot, me: PlayerId): BotDecision {
  const view = port.currentView();
  if (!isSorcerySpeedWindow(snapshot, view)) {
    return act({ t: 'PassPriority', player: me }, 'nothing to do at instant speed');
  }

  // ⚠️ The land drop first, always — mirroring `shouldAutoPass`'s own rule that
  // a player is never auto-passed out of one. A missed land drop is a whole turn
  // of development that cannot be recovered.
  const lands = snapshot.legal.filter((x): x is Land => x.t === 'PlayLand');
  const land = [...lands].sort((a, b) => landOrder(view, me, a, b))[0];
  if (land) return act({ t: 'PlayLand', player: me, card: land.card, faceIndex: land.faceIndex }, `play ${land.label}`);

  const casts = snapshot.legal
    .filter((x): x is Cast => x.t === 'CastSpell' && x.affordable && !x.hasX)
    .sort((a, b) => castOrder(view, a, b));

  for (const cast of casts) {
    const specs = port.targetSpecsFor(cast.card);
    // ⚠️ THE LIVELOCK GUARD, and the other half of `awaiting.ts`'s
    // `CancelPendingCast`. `legalActions` does not look at targets at all — it
    // offers Swords to Plowshares against an empty board — so without this the
    // bot would cast, be asked, cancel, and cast the same card again forever.
    const targets = specs.length > 0 ? planTargets(port, cast.card, specs, view, me) : [];
    if (targets === null) continue;

    // ⚠️ Through `previewCast`, not a bare `CastSpell`. That is the path a real
    // player takes and the one that proves the client's solver and the host's
    // validator agree about a plan built from a `SolveInput` off the wire.
    const preview = port.previewCast(cast.card, 0, targets);
    if (!preview?.plan) continue;
    return act(
      { t: 'CastSpell', player: me, card: cast.card, faceIndex: cast.faceIndex, plan: preview.plan, targets },
      `cast ${cast.label}`,
    );
  }

  return act({ t: 'PassPriority', player: me }, 'nothing worth casting');
}

/**
 * THE entry point. Same argument shape as `simplestIntent(session, snapshot)` on
 * purpose, so the two are interchangeable in a harness.
 *
 * ⚠️ A different RETURN type, and that is the D102 fix rather than a style
 * choice: `Intent | null` cannot tell "this prompt is not mine" from "I have no
 * answer", and those two must be distinguishable or a wedged game is
 * indistinguishable from a healthy idle one.
 */
export function decide(
  port: BotPort,
  snapshot: BotSnapshot,
  cfg: BotConfig,
  attempt = 0,
): BotDecision {
  // ⚠️ Level 0 is the legal-random BASELINE, not a difficulty (see `types.ts`).
  // It is routed here rather than beside the runner so that everything measuring
  // a level goes through one entry point — a tournament that reached level 0 by a
  // different path would not be measuring the same thing the game plays.
  if (cfg.level === 0) return decideRandom(port, snapshot, cfg, attempt);
  if (!snapshot.running || snapshot.finished) return wait('the game is not running');
  const me = snapshot.you;
  if (snapshot.awaiting) return answerAwaiting(port, snapshot.awaiting, me, attempt);
  if (snapshot.priority !== me) return wait('someone else holds priority');
  return priorityAction(port, snapshot, me);
}

/** Whether a card in hand is a land — exported so the tests can build a hand. */
export function isLandCard(card: CardView): boolean {
  const face = card.card?.faces[0];
  return face ? parseTypeLine(face.typeLine).types.includes('Land') : false;
}

export type { Intent };
