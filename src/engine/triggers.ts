// The trigger bus and the replacement funnel.
//
// ⚠️ Because EVERY state change goes through an event — including all Tier-3
// manual tools — nothing can change the board without the bus seeing it. There
// is no "and remember to fire triggers here" call site to forget, which is the
// single most common way a rules engine develops a permanently missing trigger.
//
// With `SHIPPED_REGISTRY` (what v1 ships) `collectTriggers` iterates an empty
// candidate list and returns []. The three built-ins below — the commander zone,
// and the loyalty/defense counters a permanent gets on entering and on becoming
// a planeswalker — are the replacements that are NOT card scripts, because they
// are rules rather than cards.

import { derive, makeDeriveCache } from './derive';
import { faceOf } from './oracle';
import type { ScriptRegistry } from './scripts/registry';
import { KEYWORD_TRIGGERS } from './keywordTriggers';
import type { CardMove, EventBody, GameEvent } from './types/events';
import type { InstanceId, PlayerId, ZoneRef } from './types/ids';
import { isAskedCondition, type EntersTappedCondition } from '../data/replacementParse';
import type { DerivedCharacteristics, OracleCard, OracleDb } from './types/oracle';
import {
  livingPlayers,
  type Awaiting,
  type CardInstance,
  type GameState,
  type PendingReplacement,
  type PendingTrigger,
} from './types/state';

/**
 * The single funnel every event passes through before it is appended.
 *
 * Returning `[]` prevents the event entirely; returning several replaces it.
 * One funnel means a replacement effect sees every candidate exactly once —
 * with N call sites it would see some of them twice and others never.
 */
export function applyReplacements(
  state: GameState,
  oracle: OracleDb,
  // ⚠️ **A BUILT-IN NOW READS IT (D156).** It used to be kept only to hold the
  // funnel signature steady; `withEntersTapped` threads it into the board
  // queries so "do you control a Forest" is answered from DERIVED
  // characteristics with the real registry, rather than from an empty one that
  // ignores every static a card script might add.
  scripts: ScriptRegistry,
  ev: EventBody,
): EventBody[] {
  void scripts;
  let events: EventBody[] = [ev];

  // Built-in: CR 903.9a. A commander that would go to a graveyard or exile from
  // anywhere may go to the command zone instead, at its owner's choice.
  if (ev.t === 'CardsMoved') {
    events = commanderZoneReplacement(state, ev.moves);
    // ⚠️ AFTER the commander rule, and reading ITS output rather than `ev`. That
    // rule can redirect a move, and a second replacement that read the original
    // would be answering a question about a board that never happened.
    events = withEntryCounters(state, oracle, events);
    events = withEntersTapped(state, oracle, scripts, events);
    // ⚠️ LAST of the built-ins, so the question is asked about a permanent
    // whose tapped state and counters are already settled — and so a card that
    // both enters tapped AND names a colour raises one prompt, not two at once.
    events = withChosenColor(state, oracle, events);
  }

  // Built-in: the other half of CR 306.5b. A permanent already on the
  // battlefield that BECOMES a planeswalker gets its loyalty the same way one
  // that arrives as a planeswalker does.
  if (ev.t === 'FaceIndexSet') {
    events = withTransformCounters(state, oracle, ev);
  }

  // ⚠️ **THE BUILT-INS AND NOTHING ELSE, since D148.** Card-script replacements
  // moved to `runReplacementFunnel` below, because CR 616 lets them ASK — and a
  // function that returns `EventBody[]` has nowhere to put a question. The
  // built-ins stay here because none of them can: the two that prompt (D136's
  // pay-to-enter, D147's colour) raise an ordinary `AwaitingSet` alongside an
  // event that has already happened, which is exactly the trick CR 616 cannot
  // use.
  return events;
}

type ReplacementEntry = ReturnType<ScriptRegistry['replacements']>[number];

/**
 * Apply registered replacement effects to ONE event, CR 614.
 *
 * ⚠️ **THIS WAS DEAD CODE UNTIL D134.** `applyReplacements` fetched
 * `scripts.replacements()`, checked whether the list was empty, and then
 * returned `events` unchanged EITHER WAY — so a registered `ReplacementDef` had
 * never run, in any game, since M3. D130 and D131 both named it while measuring
 * something else. It is exactly `TriggerDef.optional`'s shape (D128): a seam in
 * the API that nothing consumed, invisible because nothing raised it.
 *
 * ⚠️ **`used` IS THE TERMINATION ARGUMENT, AND IT IS ALSO THE RULE.** CR 614.5:
 * an effect applies at most once to a given event. Without it `Hardened Scales`
 * ("if one or more +1/+1 counters would be put on a creature you control, that
 * many plus one are put on it instead") replaces its own output forever — the
 * unbounded recursion `api.ts` warns about in a comment and could not enforce.
 * The set is shared across the fan-out of one original event, so a replacement
 * that turns one event into three cannot re-fire on any of them.
 *
 * ⚠️ **CR 616's CHOICE IS NOT BUILT, and this is where it would go.** When
 * several replacements apply to one event, the affected object's controller
 * chooses which applies first — and that is a PROMPT, a real decision that
 * changes outcomes: `Hardened Scales` then `Branching Evolution` turns two
 * counters into six, the other order gives five. This applies them in
 * BATTLEFIELD order, which is the timestamp order D129 established for layers
 * and is deterministic and replayable — but it is not the player's choice. A
 * card whose correctness depends on choosing stays unregistered, which costs
 * nothing today because `SHIPPED_REGISTRY` ships.
 */
/** What the funnel produced, or the question it stopped on. */
export type FunnelResult =
  | { readonly kind: 'done'; readonly events: readonly EventBody[] }
  | {
      readonly kind: 'ask';
      /** Events already settled, to be applied BEFORE the question is asked. */
      readonly settled: readonly EventBody[];
      readonly pending: PendingReplacement;
    };

/** Every registered replacement that applies to `ev` and has not yet fired. */
function applicableTo(
  state: GameState,
  oracle: OracleDb,
  scripts: ScriptRegistry,
  defs: readonly ReplacementEntry[],
  ev: EventBody,
  used: ReadonlySet<string>,
): { key: string; sourceId: InstanceId; def: ReplacementEntry['def'] }[] {
  const cache = makeDeriveCache(state);
  const out: { key: string; sourceId: InstanceId; def: ReplacementEntry['def'] }[] = [];
  // ⚠️ BATTLEFIELD ORDER, still — it is the tie-break when the choice is not
  // the player's (one applicable effect) and it is the order the options are
  // OFFERED in, which is the order they appear on screen. CR 613.7c's timestamp,
  // the same property D129 leans on for layers.
  for (const sourceId of state.zones.battlefield) {
    const source = state.cards[sourceId];
    if (!source) continue;
    for (const { script, def } of defs) {
      if (source.oracleId !== script.oracleId) continue;
      if (!def.activeZones.includes(source.zone.kind)) continue;
      // CR 613 layer 6 — see `hasAbilities`. A silenced permanent replaces
      // nothing.
      if (!hasAbilities(state, oracle, scripts, sourceId)) continue;
      const key = `${sourceId}#${def.abilityId}`;
      if (used.has(key)) continue;
      if (!def.applies(readonlyCtx(state, oracle, scripts, cache), sourceId, ev)) continue;
      out.push({ key, sourceId, def });
    }
  }
  return out;
}

/**
 * Push one event and its fan-out through the registered replacements.
 *
 * ⚠️ **ONE QUEUE, ONE `used`.** CR 614.5 is per-event, and every level of one
 * event's fan-out is still that event — so a replacement that turns one event
 * into three splices them into the queue and the loop carries on with the same
 * set. That is why the continuation needs no stack of frames: only the BATCH
 * boundary starts a fresh `used`.
 *
 * ⚠️ **`used` IS ALSO THE TERMINATION ARGUMENT.** Without it `Hardened Scales`
 * replaces its own output forever — its result matches its own condition. It
 * does not return a wrong number; it does not return.
 */
function runFanOut(
  state: GameState,
  oracle: OracleDb,
  scripts: ScriptRegistry,
  defs: readonly ReplacementEntry[],
  first: EventBody,
  usedIn: readonly string[],
): FunnelResult {
  const used = new Set(usedIn);
  const settled: EventBody[] = [];
  const queue: EventBody[] = [first];

  while (queue.length > 0) {
    const ev = queue.shift() as EventBody;
    const applicable = applicableTo(state, oracle, scripts, defs, ev, used);

    if (applicable.length === 0) {
      settled.push(ev);
      continue;
    }

    // ⚠️ **CR 616.1 — TWO OR MORE IS A DECISION, ONE IS NOT.** With a single
    // applicable effect there is nothing to choose, so asking would be a
    // question with one legal answer. This is the entire trigger for the
    // continuation, and it is why the common case costs nothing.
    if (applicable.length >= 2) {
      return {
        kind: 'ask',
        settled,
        pending: {
          event: ev,
          player: affectedPlayer(state, ev),
          used: [...used],
          siblings: [...queue],
          // Both filled in by the caller: this function can see one event's
          // fan-out and nothing above it.
          rest: [],
          queued: [],
        },
      };
    }

    const only = applicable[0] as { key: string; sourceId: InstanceId; def: ReplacementEntry['def'] };
    used.add(only.key);
    const cache = makeDeriveCache(state);
    // `[]` prevents the event entirely (CR 614.1). Anything else goes back into
    // the queue AT THE FRONT, so a replaced event's own output is offered to the
    // remaining effects before this event's siblings are looked at.
    queue.unshift(...only.def.replace(readonlyCtx(state, oracle, scripts, cache), only.sourceId, ev));
  }

  return { kind: 'done', events: settled };
}

/**
 * Push a whole batch through the registered replacements.
 *
 * ⚠️ Each body starts with an EMPTY `used` — CR 614.5 again. A wrath that moves
 * four creatures is four events, and an effect that replaces one of them must
 * still be offered the other three.
 */
export function runReplacementFunnel(
  state: GameState,
  oracle: OracleDb,
  scripts: ScriptRegistry,
  bodies: readonly EventBody[],
): FunnelResult {
  const defs = scripts.replacements();
  const settled: EventBody[] = [];

  for (let i = 0; i < bodies.length; i++) {
    const body = bodies[i];
    if (!body) continue;
    // ⚠️ Built-ins FIRST and per body, against the state as it stands — which is
    // why the batch is walked here rather than flat-mapped up front. A built-in
    // asks about the board ("do you control two other lands"), and the answer
    // changes as the batch is applied.
    const builtIn = applyReplacements(state, oracle, scripts, body);
    if (defs.length === 0) {
      settled.push(...builtIn);
      continue;
    }
    for (let k = 0; k < builtIn.length; k++) {
      const ev = builtIn[k];
      if (!ev) continue;
      const r = runFanOut(state, oracle, scripts, defs, ev, []);
      if (r.kind === 'done') {
        settled.push(...r.events);
        continue;
      }
      return {
        kind: 'ask',
        settled: [...settled, ...r.settled],
        pending: {
          ...r.pending,
          rest: builtIn.slice(k + 1),
          queued: bodies.slice(i + 1),
        },
      };
    }
  }
  return { kind: 'done', events: settled };
}

/**
 * Resume the funnel with one replacement chosen (CR 616.1), and keep going.
 *
 * ⚠️ It may stop again immediately: applying one effect can leave two others
 * still applicable, which is precisely the "then repeat" half of the rule.
 */
export function resumeReplacementFunnel(
  state: GameState,
  oracle: OracleDb,
  scripts: ScriptRegistry,
  pending: PendingReplacement,
  chosenKey: string,
): FunnelResult {
  const defs = scripts.replacements();
  const applicable = applicableTo(state, oracle, scripts, defs, pending.event, new Set(pending.used));
  const chosen = applicable.find((a) => a.key === chosenKey);
  // The caller validates; this is the belt on the braces, and returning the
  // event unreplaced is the only safe answer if it ever fires.
  if (!chosen) {
    return { kind: 'done', events: [pending.event, ...pending.siblings, ...pending.rest, ...pending.queued] };
  }

  const cache = makeDeriveCache(state);
  const produced = chosen.def.replace(readonlyCtx(state, oracle, scripts, cache), chosen.sourceId, pending.event);
  const used = [...pending.used, chosen.key];

  // The chosen effect's output, then this event's remaining fan-out — all under
  // the SAME `used`, exactly as `runFanOut` would have carried on.
  // The chosen effect's output, then this event's remaining fan-out — all under
  // the SAME `used`, exactly as `runFanOut` would have carried on.
  const sameEvent = [...produced, ...pending.siblings];
  const settled: EventBody[] = [];
  for (let i = 0; i < sameEvent.length; i++) {
    const ev = sameEvent[i];
    if (!ev) continue;
    const r = runFanOut(state, oracle, scripts, defs, ev, used);
    if (r.kind === 'done') {
      settled.push(...r.events);
      continue;
    }
    // ⚠️ All three queues are still owed, at three different `used` levels.
    return {
      kind: 'ask',
      settled: [...settled, ...r.settled],
      pending: {
        ...r.pending,
        siblings: [...r.pending.siblings, ...sameEvent.slice(i + 1)],
        rest: pending.rest,
        queued: pending.queued,
      },
    };
  }

  // This body's remaining built-in output — fresh `used` each, no built-ins.
  for (let i = 0; i < pending.rest.length; i++) {
    const ev = pending.rest[i];
    if (!ev) continue;
    const r = runFanOut(state, oracle, scripts, defs, ev, []);
    if (r.kind === 'done') {
      settled.push(...r.events);
      continue;
    }
    return {
      kind: 'ask',
      settled: [...settled, ...r.settled],
      pending: { ...r.pending, rest: pending.rest.slice(i + 1), queued: pending.queued },
    };
  }

  // And finally the rest of the batch, which still needs the built-ins.
  const after = runReplacementFunnel(state, oracle, scripts, pending.queued);
  if (after.kind === 'done') return { kind: 'done', events: [...settled, ...after.events] };
  return { kind: 'ask', settled: [...settled, ...after.settled], pending: after.pending };
}

/**
 * Who chooses, per CR 616.1 — "the affected object's controller (or its owner if
 * it has no controller) or the affected player".
 *
 * ⚠️ A CLOSED LIST WITH A STATED FALLBACK, rather than a guess per event kind.
 * Every entry here is an event a replacement in this engine can actually see;
 * anything else falls to the active player, which is wrong in no case that
 * exists today and is at least always a living seat.
 */
function affectedPlayer(state: GameState, ev: EventBody): PlayerId {
  const of = (id: InstanceId | undefined): PlayerId | null => {
    const card = id === undefined ? undefined : state.cards[id];
    return card ? card.controller || card.owner : null;
  };
  switch (ev.t) {
    case 'CountersChanged':
      return of(ev.changes[0]?.card) ?? state.turn.activePlayer;
    case 'CardsMoved':
      return of(ev.moves[0]?.card) ?? state.turn.activePlayer;
    case 'PermanentsTapped':
    case 'PermanentsUntapped':
      return of(ev.cards[0]) ?? state.turn.activePlayer;
    case 'LifeChanged':
    case 'PoisonChanged':
      return ev.player;
    case 'DamageDealt': {
      const target = ev.damages[0]?.target;
      if (target?.kind === 'player') return target.id;
      return of(target?.id) ?? state.turn.activePlayer;
    }
    default:
      return state.turn.activePlayer;
  }
}

function commanderZoneReplacement(state: GameState, moves: readonly CardMove[]): EventBody[] {
  const mode = state.options.commanderZoneReplacement;
  if (mode === 'never') return [{ t: 'CardsMoved', moves }];

  const rewritten: CardMove[] = [];
  const queue: { player: PlayerId; card: InstanceId; from: ZoneRef }[] = [];

  for (const move of moves) {
    const card = state.cards[move.card];
    const leavingToBin = move.to.kind === 'graveyard' || move.to.kind === 'exile';
    if (!card || !card.isCommander || card.isToken || !leavingToBin || move.from.kind === 'command') {
      rewritten.push(move);
      continue;
    }
    const owner = state.players[card.owner];
    const always = owner?.commanderZoneAlways;
    if (mode === 'always' || always === true) {
      rewritten.push({ ...move, to: { kind: 'command', player: card.owner } });
      continue;
    }
    if (always === false) {
      rewritten.push(move);
      continue;
    }
    // 'ask': let it land, then offer the choice. Queued rather than a single
    // card, because a wrath can bin both halves of a partner pair at once and
    // abandoning the second would lose a commander with no way back.
    rewritten.push(move);
    queue.push({ player: card.owner, card: move.card, from: move.to });
  }

  const out: EventBody[] = [{ t: 'CardsMoved', moves: rewritten }];
  if (queue.length > 0) {
    const head = queue[0];
    if (head) {
      const awaiting: Awaiting = { kind: 'commanderZoneChoice', player: head.player, queue };
      out.push({ t: 'AwaitingSet', awaiting });
    }
  }
  return out;
}

/**
 * Built-in: CR 306.5b and 310.6. A planeswalker enters the battlefield with a
 * number of loyalty counters equal to its PRINTED loyalty; a battle with defense
 * counters equal to its printed defense.
 *
 * ⚠️ A REPLACEMENT EFFECT, which is why it lives in this funnel (CR 614.1c —
 * "enters with counters" is a replacement, not a trigger). Ten different places
 * can move a card onto the battlefield — a cast resolving, a land drop, an
 * effect, four Tier-3 manual tools, combat's own cleanup — and adding the
 * counters at each of them would be the "some candidates twice, others never"
 * failure the funnel exists to prevent. It never happened at any of them, so
 * every planeswalker entered with zero loyalty and SBA 4 binned it on the same
 * pass. Nobody saw it because neither starter deck contains one.
 *
 * ⚠️ AN EVENT, never a reducer branch. `apply` is pure in (state, event) alone
 * and cannot look a printing up, so counters added inside the `CardsMoved` case
 * would be a state change the replay could not reproduce. Counters are part of
 * `GameState` and so of the state hash — that is exactly the disagreement the
 * fuzzer would report 200 events later with no visible cause.
 *
 * ⚠️ The PRINTED value, off the oracle face, not `derive()`'s. CR says printed,
 * and the pre-move state derives from the wrong zone anyway: a face-down entry
 * is only a 2/2 with no types once it has ARRIVED (`layerOne` checks
 * `zone.kind === 'battlefield'`), so deriving here would hand a face-down
 * planeswalker its loyalty.
 *
 * Face 0 is always the right face: `clearBattlefieldFields` resets `faceIndex`
 * on every entry, so a card cannot arrive showing its back. A permanent that
 * TRANSFORMS into a planeswalker afterwards is a different rule, and it is
 * `withTransformCounters` below — 14 Commander-legal cards, all reached through
 * the Tier-3 Transform button, all needing the set-to-N semantics this
 * entry-only delta cannot express (D108).
 *
 * Measured over all 113,559 printings: a printed loyalty appears on no
 * non-planeswalker face and a printed defense on no non-battle face, so the type
 * check below never disagrees with the number — it is here so this rule and
 * SBA 4 decide "is this a planeswalker" the same way rather than two ways.
 * 288 of the 289 Commander-legal planeswalkers have a numeric printed loyalty
 * (Nissa, Steward of Elements prints `X`) and all 36 battles a numeric defense.
 * There are no planeswalker or battle TOKENS at all, which is why `TokenCreated`
 * needs nothing here.
 */
/**
 * The face a card is arriving as — the move's if it names one, the card's own
 * otherwise.
 *
 * ⚠️ **ONE READER FOR BOTH ENTRY RULES**, because they are the same question one
 * rule apart and the two of them disagreeing is how a modal DFC would enter with
 * the loyalty of one face and the tapped-ness of the other. D155.
 */
function enteringFace(move: CardMove, card: CardInstance, printing: OracleCard) {
  return faceOf(printing, move.faceIndex ?? card.faceIndex);
}

function withEntryCounters(
  state: GameState,
  oracle: OracleDb,
  events: readonly EventBody[],
): EventBody[] {
  const changes: { card: InstanceId; kind: string; delta: number }[] = [];
  for (const ev of events) {
    if (ev.t !== 'CardsMoved') continue;
    for (const move of ev.moves) {
      if (move.to.kind !== 'battlefield' || move.from.kind === 'battlefield') continue;
      // CR 708.2: a face-down permanent is a 2/2 creature with no name and no
      // types. It is not a planeswalker, so it gets no loyalty.
      if (move.faceDown) continue;
      const card = state.cards[move.card];
      if (!card) continue;
      const printing = oracle.byPrinting(card.printingId);
      if (!printing) continue;
      // ⚠️ **THE FACE THE MOVE NAMES, THEN THE CARD'S OWN** — here and in
      // `withEntersTapped` below, which is the same read one rule along.
      //
      // ⚠️ D155 built the path this comment used to say did not exist. The
      // constraint it named still governs and is what put the face on the MOVE:
      // `applyReplacements` runs on the state BEFORE its own event, so a card
      // entering as its back face has not had `faceIndex` written yet and never
      // could have. `enteringFace` reads it off the move instead.
      const face = enteringFace(move, card, printing);
      const { baseLoyalty, baseDefense } = face;
      if (baseLoyalty !== null && baseLoyalty > 0 && face.typeLine.types.includes('Planeswalker')) {
        changes.push({ card: move.card, kind: 'loyalty', delta: baseLoyalty });
      }
      if (baseDefense !== null && baseDefense > 0 && face.typeLine.types.includes('Battle')) {
        changes.push({ card: move.card, kind: 'defense', delta: baseDefense });
      }
    }
  }
  if (changes.length === 0) return [...events];
  // One event for the whole batch — a wrath that returns three planeswalkers is
  // one `CountersChanged`, exactly as the SBA's own counter pass is.
  //
  // ⚠️ A DELTA onto a card that has just arrived, and it is exact because
  // `clearBattlefieldFields` empties `counters` on every entry. It is appended
  // rather than prepended for the same reason: it has to land after the move it
  // belongs to, or it would add counters to a card still in its old zone.
  return [...events, { t: 'CountersChanged', changes }];
}

/**
 * Built-in: CR 614.1c — a permanent whose printed text says it enters the
 * battlefield tapped, does.
 *
 * ⚠️ A REPLACEMENT, in this funnel for exactly D107's reasons: ten different
 * places move a card onto the battlefield, and adding the tap at each of them
 * would be the "some candidates twice, others never" failure the funnel exists
 * to prevent. It is also an EVENT rather than a reducer branch, because `apply`
 * is pure in (state, event) alone and cannot look a printing up — a tap applied
 * inside the `CardsMoved` case would be a state change replay could not
 * reproduce, and `tapped` is part of the state hash.
 *
 * ⚠️ THE CONDITION IS EVALUATED (D135); THE QUESTION IS ASKED (D136). Seven of
 * the eight `EntersTappedCondition` kinds are board queries `conditionHolds`
 * answers with no input from anybody. The eighth — "you may pay N life" — is a
 * PROMPT, and it is the reason this function returns an awaiting as well as a
 * tap. A clause `replacementParse.ts` cannot read completely is still refused,
 * and this rule asks it rather than re-reading the text.
 *
 * ⚠️ FACE-DOWN ENTRIES ARE EXCLUDED, the same guard the entry counters use: CR
 * 708.2 makes a face-down permanent a 2/2 with no abilities, so it has no
 * "enters tapped" to apply however its face reads underneath.
 *
 * Measured over the Commander-legal pool: 538 lines carry the unconditional
 * clause and **104 cards are finished by it alone** (D134); the conditions add
 * 65 (D135) and the question 16 (D136).
 */
function withEntersTapped(
  state: GameState,
  oracle: OracleDb,
  scripts: ScriptRegistry,
  events: readonly EventBody[],
): EventBody[] {
  const tapping: InstanceId[] = [];
  const asking: { card: InstanceId; player: PlayerId; life: number; label: string }[] = [];
  for (const ev of events) {
    if (ev.t !== 'CardsMoved') continue;
    for (const move of ev.moves) {
      if (move.to.kind !== 'battlefield' || move.from.kind === 'battlefield') continue;
      if (move.faceDown) continue;
      const card = state.cards[move.card];
      if (!card) continue;
      const printing = oracle.byPrinting(card.printingId);
      if (!printing) continue;
      const face = enteringFace(move, card, printing);
      const rule = face.entersTapped;
      if (!rule) continue;
      // ⚠️ The controller comes from the DESTINATION, then the card. A
      // battlefield `ZoneRef` carries the controller in `to.player` on every
      // path that puts a permanent down; `findZoneOf` builds one with `null`,
      // and a condition asking "do YOU control two other lands" of the wrong
      // seat is wrong in the direction nobody notices.
      const controller = move.to.player ?? card.controller ?? card.owner;
      const unless = rule.unless;
      if (unless !== null) {
        if (isAskedCondition(unless)) {
          // ⚠️ **A PLAYER WHO CANNOT PAY IS NOT ASKED** (CR 119.4 — you may pay
          // N life only with a life total of at least N). Asking anyway offers a
          // choice whose "yes" the handler must then refuse, which is a prompt
          // that can wedge; and at EXACTLY N life the payment is legal, so this
          // is `<` and not `<=` — a shock land played at 2 life may still be
          // paid for, and the player then loses to SBA 1, which is their call to
          // make. A player already out of the game is not asked either, for
          // `optionalTrigger`'s reason (D128): their answer is not in doubt.
          const seat = state.players[controller];
          if (seat && !seat.hasLost && seat.life >= unless.life) {
            asking.push({ card: move.card, player: controller, life: unless.life, label: face.name });
            continue;
          }
        } else if (conditionHolds(state, oracle, scripts, unless, controller)) {
          continue;
        }
      }
      tapping.push(move.card);
    }
  }
  const out: EventBody[] = [...events];
  // Appended, so it lands after the move it belongs to — a tap emitted before
  // would name a card still in its old zone, and `reducer.ts` drops a tap
  // outside the battlefield (CR 110.5b) without saying why.
  if (tapping.length > 0) out.push({ t: 'PermanentsTapped', cards: tapping });
  const head = asking[0];
  if (head) {
    // ⚠️ **THE WHOLE BATCH'S QUESTIONS, HEAD FIRST.** One `CardsMoved` can put
    // several of these lands down — a Tier-3 zone move, or a spell that puts two
    // out — and asking about one while silently tapping the rest is exactly the
    // half-execution `commanderZoneChoice` grew its own queue to avoid.
    out.push({
      t: 'AwaitingSet',
      awaiting: {
        kind: 'entersChoice',
        player: head.player,
        source: head.card,
        life: head.life,
        label: head.label,
        queue: asking.slice(1),
      },
    });
  }
  return out;
}

/**
 * Does the "unless" clause hold, right now?
 *
 * ⚠️ **THE ENTERING PERMANENT IS NOT ON THE BATTLEFIELD YET**, and every "other
 * lands" count depends on it. `applyReplacements` runs on the state BEFORE its
 * event is applied — the same property `withTransformCounters` relies on to see
 * the old face — so counting the battlefield as it stands is exactly the "other"
 * the cards mean. Nothing here has to exclude the card itself, and a version
 * that did would be wrong by one on every dual land in the format.
 *
 * ⚠️ Read through `derive`, not off the printed type line: a land whose types
 * were changed is the board the player is looking at. The cache is per call
 * because these are cheap and rare — one land drop, not a sweep.
 *
 * ⚠️ **`payLife` IS EXCLUDED FROM THE PARAMETER TYPE, not handled in the
 * switch.** It is the one condition a player answers rather than the board (see
 * `isAskedCondition`), and every wrong way to write that here is silent: a
 * `false` branch taps the land and never asks — D135's refusal reintroduced as a
 * bug — and a `true` branch lets it in untapped for free. Excluding it makes the
 * mistake a COMPILE ERROR, which is the same instrument D125 used to stop
 * `simplestAnswer` returning null. A ninth condition added and forgotten fails
 * `tsc -b` here rather than shipping.
 */
function conditionHolds(
  state: GameState,
  oracle: OracleDb,
  scripts: ScriptRegistry,
  condition: Exclude<EntersTappedCondition, { kind: 'payLife' }>,
  controller: PlayerId,
): boolean {
  const cache = makeDeriveCache(state);
  const mine = state.zones.battlefield.filter((id) => state.cards[id]?.controller === controller);
  // ⚠️ THE REAL REGISTRY, and it used to be an empty one (D156). These are
  // board QUERIES — "do you control two other lands", "a Forest", "a basic
  // land" — answered from DERIVED characteristics, so deriving them without
  // card scripts would ignore every static that changes a type. Harmless while
  // nothing ships and wrong the moment M6.4 lands its first Blood Moon.
  const d = (id: InstanceId): DerivedCharacteristics => derive(state, oracle, scripts, id, cache);

  switch (condition.kind) {
    case 'otherLands': {
      const n = mine.filter((id) => d(id).isLand).length;
      return condition.at === 'least' ? n >= condition.count : n <= condition.count;
    }
    case 'basicLands':
      return (
        mine.filter((id) => d(id).isLand && d(id).typeLine.supertypes.includes('Basic')).length >=
        condition.count
      );
    case 'otherLandsOfType':
      return (
        mine.filter((id) => d(id).typeLine.subtypes.includes(condition.subtype)).length >=
        condition.count
      );
    case 'opponents':
      return livingPlayers(state).filter((id) => id !== controller).length >= condition.count;
    case 'anyPlayerLifeAtMost':
      // "A player" is ANY player, including the one playing the land.
      return livingPlayers(state).some((id) => (state.players[id]?.life ?? 0) <= condition.life);
    case 'opponentsLands':
      return (
        state.zones.battlefield.filter((id) => {
          const c = state.cards[id];
          return !!c && c.controller !== controller && d(id).isLand;
        }).length >= condition.count
      );
    case 'controlPermanent':
      return mine.some((id) => {
        const chars = d(id);
        return condition.any.some(
          (p) =>
            p.supertypes.every((t) => chars.typeLine.supertypes.includes(t)) &&
            p.types.every((t) => chars.typeLine.types.includes(t)) &&
            p.subtypes.every((t) => chars.typeLine.subtypes.includes(t)) &&
            p.colors.every((c) => chars.colors.includes(c)),
        );
      });
  }
}

/**
 * Built-in: the OTHER half of CR 306.5b. A permanent that becomes a
 * planeswalker — by transforming into one, rather than by arriving as one —
 * gets loyalty counters equal to the printed loyalty of the face it is now
 * showing. `withEntryCounters` above is the same rule reached by entering;
 * without this one, all 14 cards that transform into a planeswalker landed on an
 * empty counter map and SBA 4 binned them on the same pump, which is exactly the
 * bug D107 fixed, one step along.
 *
 * ⚠️ **SET TO N, NOT ADD N**, and that is the whole reason this is a separate
 * rule rather than a line inside the entry one. `CountersChanged` is a DELTA and
 * the Tier-3 Transform button TOGGLES, so `+5` on every flip would leave a
 * flipped-away-and-back Jace on 10. The delta is computed against what the card
 * is carrying at this instant, so the planeswalker face always lands on exactly
 * its printed number no matter what came before. An entry can assume 0 because
 * `clearBattlefieldFields` empties `counters`; a transform cannot assume
 * anything.
 *
 * ⚠️ **The trigger is the TRANSITION, not the destination.** "Becomes a
 * planeswalker" is a change of state, so a permanent that was ALREADY one and
 * still is gets nothing. Two Commander-legal cards are planeswalkers on both
 * faces — `Arlinn Kord // Arlinn, Embraced by the Moon` and `Garruk Relentless
 * // Garruk, the Veil-Cursed` — and both are also the DB's only planeswalker
 * faces with no printed loyalty at all. Without this check, flipping Arlinn to
 * her back face and back would refill her loyalty from 1 to 3, which is the
 * opposite of what her own rulings say: a permanent keeps its counters across a
 * transform (CR 701.28 turns the card over and does nothing to what is on it).
 *
 * ⚠️ A NULL printed loyalty means ADD NOTHING, never 0 — a `delta` computed
 * against 0 would strip the counters a both-faces planeswalker is carrying.
 * Today the two null faces are the same two cards the transition check already
 * covers, so either guard alone would hold; they are both here because they
 * answer different questions and the next set can print a card that needs only
 * one of them.
 *
 * ⚠️ **No defense branch, measured rather than assumed.** Of 113,559 printings,
 * **no card has a non-Battle front face and a Battle back face** — a Siege
 * transforms INTO something else, never into a battle — so "becomes a battle" is
 * reachable only by flipping a Siege backwards with the Tier-3 button, where
 * leaving its counters alone is both what CR 701.28 says and the un-surprising
 * answer. This is the same shape as D107's reason for giving `TokenCreated` no
 * branch: zero cards, so zero code.
 *
 * Scope, measured over the same database: **14** Commander-legal cards have a
 * non-planeswalker front face and a planeswalker back face, all 14 print a
 * numeric loyalty (2–7), 12 are `transform` and 2 are `modal_dfc`. Every one of
 * them is reached through the Tier-3 Transform button, because
 * `clearBattlefieldFields` resets `faceIndex` on entry and so nothing can arrive
 * already showing its back — including `Nicol Bolas, the Ravager`, whose own
 * ability returns it to the battlefield transformed.
 *
 * ⚠️ Where this deliberately diverges from CR: a permanent that becomes a
 * planeswalker a SECOND time would, read literally, GET printed-loyalty more
 * counters on top of whatever it kept. Set-to-N gives it exactly the printed
 * number instead. None of the 14 can transform back in real Magic — they are all
 * one-way — so the divergence is only reachable by driving a one-way transform
 * backwards with a manual tool, and the alternative is a Jace sitting on 10.
 */
function withTransformCounters(
  state: GameState,
  oracle: OracleDb,
  ev: Extract<EventBody, { t: 'FaceIndexSet' }>,
): EventBody[] {
  const card = state.cards[ev.card];
  if (!card) return [ev];
  // A card is only a permanent on the battlefield, and loyalty counters belong
  // to a permanent. Turning a card over in a hand or a graveyard is the Tier-3
  // tool doing exactly what it says and nothing else.
  if (card.zone.kind !== 'battlefield') return [ev];
  // CR 708.2, the same check the entry rule makes: a face-down permanent is a
  // typeless 2/2, so it is not becoming a planeswalker whichever face index it
  // is carrying underneath.
  if (card.faceDown) return [ev];
  const printing = oracle.byPrinting(card.printingId);
  if (!printing) return [ev];

  // ⚠️ `card.faceIndex` is still the OLD face: the funnel runs on the state
  // BEFORE its event is applied, which is what makes the transition readable
  // here at all.
  const before = faceOf(printing, card.faceIndex);
  const after = faceOf(printing, ev.faceIndex);
  if (before.typeLine.types.includes('Planeswalker')) return [ev];
  if (!after.typeLine.types.includes('Planeswalker')) return [ev];

  const printed = after.baseLoyalty;
  if (printed === null || printed <= 0) return [ev];
  const current = card.counters['loyalty'] ?? 0;
  if (printed === current) return [ev];

  return [ev, { t: 'CountersChanged', changes: [{ card: ev.card, kind: 'loyalty', delta: printed - current }] }];
}

/**
 * Which triggered abilities fired because of this batch.
 *
 * `before`/`after` are both passed so a trigger can compare — "whenever a
 * creature dies" needs last-known information about an object that no longer
 * exists, which only `before` has.
 */
export function collectTriggers(
  before: GameState,
  after: GameState,
  applied: readonly GameEvent[],
  oracle: OracleDb,
  scripts: ScriptRegistry,
): PendingTrigger[] {
  // ⚠️ No early return on an empty registry any more (D308): the keyword
  // triggers below run with no scripts at all.
  const out: PendingTrigger[] = [];
  let n = after.eventCount * 1000;

  // ⚠️ HOISTED **AND LAZY** (D168) — D147 hoisted the id lists out of the
  // inner loop; D168 made them (and both ctxs and both derive caches) built
  // on FIRST DEMAND, because every one of them was constructed per
  // collectTriggers CALL — once per pump — while most batches contain no
  // event any def watches. That is D162's eager-maps regression one object
  // over: `Object.keys(after.cards)` alone was an O(cards) pass per pump.
  let idsAfterMemo: string[] | null = null;
  let idsBeforeMemo: string[] | null = null;
  const idsOf = (look: boolean): string[] =>
    look
      ? (idsBeforeMemo ??= Object.keys(before.cards))
      : (idsAfterMemo ??= Object.keys(after.cards));
  let ctxAfterMemo: ReturnType<typeof readonlyCtx> | null = null;
  let ctxBeforeMemo: ReturnType<typeof readonlyCtx> | null = null;
  const ctxOf = (look: boolean): ReturnType<typeof readonlyCtx> =>
    look
      ? (ctxBeforeMemo ??= readonlyCtx(before, oracle, scripts, makeDeriveCache(before)))
      : (ctxAfterMemo ??= readonlyCtx(after, oracle, scripts, makeDeriveCache(after)));

  // ⚠️ THE PER-ORACLE SOURCE INDEX (D162) — D147 hoisted the id lists; this
  // removes the remaining O(events × defs × cards) scan that D128 named and
  // the 500-seed gate finally priced: 599.5 s of a 600 s timeout at 57
  // registered defs (D161). A def can only ever fire from instances of ITS OWN
  // card, and the registry is keyed by `oracleId` — so one O(cards) pass here
  // replaces a full-board scan per (event × def), and each def walks a list
  // that is almost always empty or length one.
  //
  // ⚠️ ORDER IS LOAD-BEARING: the lists keep `Object.keys` order, so the
  // (def, id) match sequence — and therefore every `PendingTrigger` id and the
  // APNAP input order — is BIT-IDENTICAL to the scan it replaces. Proven by a
  // 60-seed A/B with byte-identical counters, not assumed.
  const indexByOracle = (state: GameState, ids: readonly string[]) => {
    const m = new Map<string, string[]>();
    for (const id of ids) {
      const o = state.cards[id]?.oracleId;
      if (!o) continue;
      const got = m.get(o);
      if (got) got.push(id);
      else m.set(o, [id]);
    }
    return m;
  };
  // ⚠️ LAZY, and the first cut's eagerness was a measured REGRESSION: built
  // unconditionally, the two maps cost an O(cards) pass of hashing and allocs
  // on EVERY collectTriggers call — and most batches contain no event any def
  // watches, so the old filtered scan they replaced never ran at all there.
  // 60-seed A/B: eager 84.8 s against the 71.4 s scan it was meant to beat,
  // with byte-identical counters. Built on first demand, the cost lands only
  // where the saved scans lived.
  let byOracleAfterMemo: Map<string, string[]> | null = null;
  let byOracleBeforeMemo: Map<string, string[]> | null = null;
  const byOracle = (look: boolean): Map<string, string[]> => {
    if (look) return (byOracleBeforeMemo ??= indexByOracle(before, idsOf(true)));
    return (byOracleAfterMemo ??= indexByOracle(after, idsOf(false)));
  };

  // ⚠️ THE PER-KIND PRESENT-DEF MEMO (D168). At 148 scripts a `CardsMoved`
  // event consults ~150 defs, most of whose cards are in nobody's deck this
  // game — and a batch can hold dozens of `CardsMoved` events. The absent
  // defs produce no matches, so SKIPPING them cannot change the match
  // sequence: this memo filters each kind's def list to defs with at least
  // one instance, once per batch, and every later event of the same kind
  // walks only the survivors. Order within the list is registry order,
  // untouched — the output is bit-identical to the unfiltered loop.
  const presentDefsByKind = new Map<string, ReturnType<ScriptRegistry['triggersFor']>>();
  const presentDefsFor = (kind: EventBody['t']): ReturnType<ScriptRegistry['triggersFor']> => {
    const got = presentDefsByKind.get(kind);
    if (got) return got;
    const filtered = scripts
      .triggersFor(kind)
      .filter(({ script, def }) => (byOracle(def.looksBack === true).get(script.oracleId)?.length ?? 0) > 0);
    presentDefsByKind.set(kind, filtered);
    return filtered;
  };

  for (const event of applied) {
    for (const { script, def } of presentDefsFor(event.body.t)) {
      // ⚠️ CR 603.10a — A TRIGGER THAT LOOKS BACK IN TIME ASKS THE OLD BOARD,
      // and every question has to move together. A "dies" trigger runs after
      // its own source has reached the graveyard, so asking `after` rejects it
      // twice over: the zone check fails `activeZones: ['battlefield']`, and
      // `matches` is handed a board the creature has already left. Before this,
      // `before` was taken as a parameter and thrown away with `void before` —
      // so a dies-trigger could not be written correctly at all (D128).
      const look = def.looksBack === true;
      const state = look ? before : after;
      const ctx = ctxOf(look);
      // The index above — only this script's own instances, in the same order
      // the full scan would have visited them.
      const candidates = byOracle(look).get(script.oracleId) ?? [];
      for (const id of candidates) {
        const card = state.cards[id];
        if (!card) continue;
        if (!def.activeZones.includes(card.zone.kind)) continue;
      // ⚠️ **CR 613 LAYER 6 — A SOURCE WITH NO ABILITIES IS NOT A SOURCE.** This
      // is the other half of `hasAbilities`: clearing an object's keywords says
      // nothing about the triggered, static and replacement abilities it has
      // through the REGISTRY, which are keyed by `oracleId` and would otherwise
      // keep firing off a Humility'd permanent forever.
      //
      // ⚠️ **AN ABILITY-REMOVAL SOURCE IS EXEMPT, AND THAT IS THE RECURSION
      // GUARD.** Asking "has this source lost its abilities" means deriving it,
      // and deriving it runs the very pass that is asking — unbounded. Exempting
      // the removers breaks the loop by construction and is right for every real
      // card: `Humility` is an enchantment and does not remove its own abilities,
      // and two of them do not silence each other. The case it cannot answer
      // needs a layer-4 type change (Opalescence), which this engine models only
      // through the Tier-3 override. Said plainly rather than left to be found.
        if (!hasAbilities(state, oracle, scripts, id)) continue;
        if (!def.matches(ctx, id, event.body)) continue;
        // ⚠️ PER-ITEM FAN-OUT (D190): a def that declares `perItem` fires once
        // per matching ITEM of the batch, each firing carrying its item —
        // per-item wording against a batched event finally pays N where the
        // rules pay N (Aya's D163 refusal class, closed at the bus). The ids
        // arrive in the EVENT's own order, so the trigger sequence replays.
        const items: readonly (InstanceId | undefined)[] = def.perItem
          ? def.perItem(ctx, id, event.body)
          : [undefined];
        for (const item of items) {
          out.push({
            id: `t${n++}`,
            source: id,
            controller: card.controller,
            abilityRef: `${script.oracleId}#${def.abilityId}`,
            label: def.label(ctx, id, event.body),
            optional: def.optional,
            // ⚠️ Copied, never looked up again: `PendingTrigger` is part of
            // `GameState`, which replays with no registry in reach.
            specs: def.targets ?? [],
            ...(item !== undefined ? { item } : {}),
          });
        }
      }
    }
  }
  // ⚠️ D308 - THE KEYWORD-TRIGGER SEAM. A keyword ability that IS a trigger
  // (prowess, exalted, bushido, flanking, persist, undying, evolve) runs from
  // one table for every permanent whose DERIVED keywords carry it - printed or
  // granted - with no script per card. The same walk as the defs above: the
  // event's kind, the battlefield (before the event for a looks-back one),
  // CR 613's silence, the entry's own `matches`, one firing per item.
  for (const event of applied) {
    for (const [keyword, kt] of KEYWORD_TRIGGERS) {
      if (kt.event !== event.body.t) continue;
      const look = kt.looksBack === true;
      const state = look ? before : after;
      const ctx = ctxOf(look);
      for (const id of idsOf(look)) {
        const card = state.cards[id];
        if (!card || card.zone.kind !== 'battlefield') continue;
        if (!hasAbilities(state, oracle, scripts, id)) continue;
        if (!ctx.derive(id).keywords.has(keyword)) continue;
        if (!kt.matches(ctx, id, event.body)) continue;
        const items: readonly (InstanceId | undefined)[] = kt.perItem ? kt.perItem(ctx, id, event.body) : [undefined];
        for (const item of items) {
          out.push({
            id: `t${n++}`,
            source: id,
            controller: card.controller,
            abilityRef: `${card.oracleId}#kw:${keyword}`,
            label: kt.label(ctx, id),
            optional: false,
            specs: [],
            ...(item !== undefined ? { item } : {}),
          });
        }
      }
    }
  }
  return out;
}

function readonlyCtx(
  state: GameState,
  oracle: OracleDb,
  scripts: ScriptRegistry,
  cache: ReturnType<typeof makeDeriveCache>,
): Parameters<NonNullable<ReturnType<ScriptRegistry['triggersFor']>[number]>['def']['matches']>[0] {
  // Advancing allocators, one pair per ctx (D164) — `matches` must not emit
  // events, but the ctx keeps the same contract as the resolution's.
  let instAlloc = state.counters.instance;
  let stackAlloc = state.counters.stack;
  return {
    state,
    oracle,
    derive: (id: InstanceId) => derive(state, oracle, scripts, id, cache),
    options: state.options,
    ids: {
      nextInstance: () => `c${++instAlloc}`,
      nextStack: () => `s${++stackAlloc}`,
    },
    query: {
      permanentsOf: (player: PlayerId) =>
        state.zones.battlefield.filter((id) => state.cards[id]?.controller === player),
      controllerOf: (id: InstanceId) => state.cards[id]?.controller ?? null,
      isOnBattlefield: (id: InstanceId) => state.cards[id]?.zone.kind === 'battlefield',
    },
    random: { below: () => 0, shuffled: <T,>(xs: readonly T[]) => xs },
  };
}

/**
 * APNAP order, starting from the active player. CR 603.3b.
 *
 * Ties inside one controller keep the order the bus found them, which is board
 * order — stable, reproducible, and the order the player sees on screen.
 */
export function orderTriggersApnap(
  state: GameState,
  triggers: readonly PendingTrigger[],
): PendingTrigger[] {
  const seats = state.seating;
  const start = Math.max(0, seats.indexOf(state.turn.activePlayer));
  const rank = new Map<PlayerId, number>();
  for (let i = 0; i < seats.length; i++) {
    const id = seats[(start + i) % seats.length];
    if (id) rank.set(id, i);
  }
  return [...triggers].sort(
    (a, b) => (rank.get(a.controller) ?? 99) - (rank.get(b.controller) ?? 99),
  );
}

/**
 * Built-in: CR 614.12. "As this ~ enters, choose a color."
 *
 * ⚠️ **THE PERMANENT HAS ALREADY ENTERED WHILE THE PROMPT IS UP**, exactly as
 * D136's pay-to-enter does and for the same structural reason:
 * `applyReplacements` is pure `(state, events) => events` and cannot suspend.
 * Nobody can act in the gap, because an `Awaiting` blocks every intent — and
 * unlike the pay-to-enter case there is nothing to get wrong here, since the
 * permanent's colour is simply unset until it is answered and a mana ability
 * scoped to it offers nothing.
 *
 * ⚠️ ONE AT A TIME, and no queue. D136 needed a queue because a Tier-3 zone move
 * can put several shock lands down at once; this raises at most one prompt per
 * batch and the next `applyReplacements` catches the rest. It is the same
 * trade-off `drainTriggers` makes for a targeted trigger: an `AwaitingSet` holds
 * exactly one question, and the loop comes back round.
 */
function withChosenColor(
  state: GameState,
  oracle: OracleDb,
  events: readonly EventBody[],
): EventBody[] {
  for (const ev of events) {
    if (ev.t !== 'CardsMoved') continue;
    for (const move of ev.moves) {
      if (move.to.kind !== 'battlefield' || move.from.kind === 'battlefield') continue;
      // CR 708.2 — a face-down permanent has no text, so it asks nothing.
      if (move.faceDown) continue;
      const card = state.cards[move.card];
      if (!card) continue;
      const printing = oracle.byPrinting(card.printingId);
      if (!printing) continue;
      if (!faceOf(printing, card.faceIndex).choosesColorOnEntry) continue;
      const player = move.to.player ?? card.controller ?? card.owner;
      const awaiting: Awaiting = {
        kind: 'chooseColor',
        player,
        source: move.card,
        label: faceOf(printing, card.faceIndex).name,
      };
      return [...events, { t: 'AwaitingSet', awaiting }];
    }
  }
  return [...events];
}

/**
 * The prompt for a suspended fold — the applicable effects, by key and label.
 *
 * ⚠️ **RECOMPUTED FROM THE BOARD, not stored on the pending.** The options are
 * derivable from `event` + `used` and nothing else, so storing them would put a
 * second copy of the same fact in the state hash — and the two could disagree if
 * a resume ever reached this with a board that had moved. One source.
 *
 * ⚠️ The label is the ability's PRINTED TEXT, because that is what the player is
 * choosing between: two `+1/+1`-counter replacements are indistinguishable by
 * card name if both copies are of the same card, and the key is an instance id
 * nobody can read.
 */
export function replacementOptions(
  state: GameState,
  oracle: OracleDb,
  scripts: ScriptRegistry,
  pending: PendingReplacement,
): { key: string; label: string }[] {
  return applicableTo(
    state,
    oracle,
    scripts,
    scripts.replacements(),
    pending.event,
    new Set(pending.used),
  ).map((a) => ({ key: a.key, label: a.def.text }));
}

/**
 * Does this object still have its abilities? CR 613 layer 6.
 *
 * ⚠️ **THE RECURSION GUARD LIVES HERE.** Deriving an object runs `applyStatics`,
 * which is the very pass that would ask this question — so asking it of a
 * SOURCE while deriving a CANDIDATE is fine (a different object), and asking it
 * of the object currently being derived would not be. Every caller is in the
 * first position: the trigger bus, the replacement funnel and the combat seam
 * all ask about a SOURCE on the battlefield, never about the thing they are
 * deriving.
 *
 * ⚠️ A derive cache is deliberately NOT threaded through: these callers run once
 * per event batch, not once per object per layer, and a cache keyed to the wrong
 * pass is worse than no cache.
 */
function hasAbilities(
  state: GameState,
  oracle: OracleDb,
  scripts: ScriptRegistry,
  id: InstanceId,
): boolean {
  return derive(state, oracle, scripts, id).hasAbilities;
}
