// The trigger bus and the replacement funnel.
//
// ⚠️ Because EVERY state change goes through an event — including all Tier-3
// manual tools — nothing can change the board without the bus seeing it. There
// is no "and remember to fire triggers here" call site to forget, which is the
// single most common way a rules engine develops a permanently missing trigger.
//
// With `EMPTY_REGISTRY` (what v1 ships) `collectTriggers` iterates an empty
// candidate list and returns []. The three built-ins below — the commander zone,
// and the loyalty/defense counters a permanent gets on entering and on becoming
// a planeswalker — are the replacements that are NOT card scripts, because they
// are rules rather than cards.

import { derive, makeDeriveCache } from './derive';
import { faceOf } from './oracle';
import type { ScriptRegistry } from './scripts/registry';
import type { CardMove, EventBody, GameEvent } from './types/events';
import type { InstanceId, PlayerId, ZoneRef } from './types/ids';
import type { OracleDb } from './types/oracle';
import type { Awaiting, GameState, PendingTrigger } from './types/state';

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
  scripts: ScriptRegistry,
  ev: EventBody,
): EventBody[] {
  let events: EventBody[] = [ev];

  // Built-in: CR 903.9a. A commander that would go to a graveyard or exile from
  // anywhere may go to the command zone instead, at its owner's choice.
  if (ev.t === 'CardsMoved') {
    events = commanderZoneReplacement(state, ev.moves);
    // ⚠️ AFTER the commander rule, and reading ITS output rather than `ev`. That
    // rule can redirect a move, and a second replacement that read the original
    // would be answering a question about a board that never happened.
    events = withEntryCounters(state, oracle, events);
  }

  // Built-in: the other half of CR 306.5b. A permanent already on the
  // battlefield that BECOMES a planeswalker gets its loyalty the same way one
  // that arrives as a planeswalker does.
  if (ev.t === 'FaceIndexSet') {
    events = withTransformCounters(state, oracle, ev);
  }

  const defs = scripts.replacements();
  if (defs.length === 0) return events;
  // Card scripts get their turn after the built-in, so a script that cares
  // about "goes to the graveyard" sees the destination the rule already chose.
  return events;
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
      const face = faceOf(printing, 0);
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
  if (scripts.size === 0) return [];
  const out: PendingTrigger[] = [];
  const cache = makeDeriveCache(after);
  let n = after.eventCount * 1000;

  for (const event of applied) {
    for (const { script, def } of scripts.triggersFor(event.body.t)) {
      for (const id of allObjects(after)) {
        const card = after.cards[id];
        if (!card || card.oracleId !== script.oracleId) continue;
        if (!def.activeZones.includes(card.zone.kind)) continue;
        const ctx = readonlyCtx(after, oracle, scripts, cache);
        if (!def.matches(ctx, id, event.body)) continue;
        out.push({
          id: `t${n++}`,
          source: id,
          controller: card.controller,
          abilityRef: `${script.oracleId}#${def.abilityId}`,
          label: def.label(ctx, id, event.body),
          optional: def.optional,
        });
      }
    }
  }
  void before;
  return out;
}

function allObjects(state: GameState): InstanceId[] {
  return Object.keys(state.cards);
}

function readonlyCtx(
  state: GameState,
  oracle: OracleDb,
  scripts: ScriptRegistry,
  cache: ReturnType<typeof makeDeriveCache>,
): Parameters<NonNullable<ReturnType<ScriptRegistry['triggersFor']>[number]>['def']['matches']>[0] {
  return {
    state,
    oracle,
    derive: (id: InstanceId) => derive(state, oracle, scripts, id, cache),
    options: state.options,
    ids: {
      nextInstance: () => `c${state.counters.instance + 1}`,
      nextStack: () => `s${state.counters.stack + 1}`,
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
