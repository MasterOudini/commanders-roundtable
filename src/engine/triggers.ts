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

import { defOnFace } from './scripts/api';
import { inPlay } from './zones';
import { mergedScripts, mergedUnder } from './mutate';
import { derive, makeDeriveCache } from './derive';
import { faceOf } from './oracle';
import { n, narrated, their, vb, who } from './narrate';
import type { ScriptRegistry } from './scripts/registry';
import { KEYWORD_TRIGGERS } from './keywordTriggers';
import { parseDevour } from './keywords';
import { STEP_ORDER } from './turn';
import { withoutPreventedDamage } from './prevention';
import { wardsMet } from './mana';
import { wardSpec } from '../data/effectParse';
import type { CardMove, EventBody, GameEvent } from './types/events';
import type { InstanceId, PlayerId, StackId } from './types/ids';
import { isAskedCondition, predicateAdmits, type EntersAsCopy, type EntersTappedCondition, type PermanentPredicate } from '../data/replacementParse';
import type { DerivedCharacteristics, Keyword, OracleCard, OracleDb } from './types/oracle';
import {
  livingPlayers,
  type Awaiting,
  type CardInstance,
  type GameState,
  type PendingReplacement,
  type Step,
  type PendingTrigger,
  type StackObject,
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

  // Built-in: CR 903.9b. A commander that would be put into its owner's hand or
  // library from anywhere may go to the command zone instead, at its owner's
  // choice. (903.9a - a graveyard or exile - is a state-based action, sba.ts.)
  if (ev.t === 'CardsMoved') {
    events = commanderZoneReplacement(state, ev.moves);
    // D577 - a daybound card entering at night enters transformed (CR 702.145b): the move's face, decided before the
    // counters, the tapped entry and the colour read the arriving face.
    events = withNightEntry(state, oracle, events);
    // ⚠️ AFTER the commander rule, and reading ITS output rather than `ev`. That
    // rule can redirect a move, and a second replacement that read the original
    // would be answering a question about a board that never happened.
    events = withEntryCounters(state, oracle, events);
    events = withEntersTapped(state, oracle, scripts, events);
    // ⚠️ LAST of the built-ins, so the question is asked about a permanent
    // whose tapped state and counters are already settled — and so a card that
    // both enters tapped AND names a colour raises one prompt, not two at once.
    events = withChosenColor(state, oracle, events);
    // D413 - a marked creature that would die goes to exile instead (CR 614.1); after the commander rule, reading its
    // output like the rest (a dying commander is exiled, and 903.9a's state-based choice follows).
    events = withExileInsteadOfDying(state, oracle, scripts, events);
    // D448 - an unearthed permanent that would leave for anywhere but exile goes to exile instead (CR 702.84c).
    events = withUnearthedLeavingToExile(state, oracle, scripts, events);
    // D541 - a discarded madness card goes to exile instead of the graveyard (CR 702.35a) - still a discard.
    events = withMadnessToExile(state, oracle, events);
  }

  // Built-in: the other half of CR 306.5b. A permanent already on the
  // battlefield that BECOMES a planeswalker gets its loyalty the same way one
  // that arrives as a planeswalker does.
  if (ev.t === 'FaceIndexSet') {
    events = withTransformCounters(state, oracle, ev);
  }

  // D470 - CR 122.1j: a permanent with a stun counter that would become untapped stays tapped and loses one
  // counter instead - the untap step's batch and an effect's untap alike.
  if (ev.t === 'PermanentsUntapped') {
    events = withStunCounters(state, oracle, ev);
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
  // D438 - THE REGISTRY-SCALING WALK: `defs` is the funnel's gate (empty means no game here replaces); the walk
  // below asks each source's OWN script for its replacement defs rather than comparing every def by oracleId.
  if (defs.length === 0) return out;
  // ⚠️ BATTLEFIELD ORDER, still — it is the tie-break when the choice is not
  // the player's (one applicable effect) and it is the order the options are
  // OFFERED in, which is the order they appear on screen. CR 613.7c's timestamp,
  // the same property D129 leans on for layers.
  for (const sourceId of inPlay(state)) {
    const source = state.cards[sourceId];
    if (!source) continue;
    // D581 - its own script's defs, then every merged card's (CR 702.140e); an under card's key names its card.
    for (const { script, faceIndex, own } of mergedScripts(scripts, state, source)) {
      for (const def of script.replacements ?? []) {
        if (!def.activeZones.includes(source.zone.kind) || !defOnFace(def, faceIndex)) continue;
        // CR 613 layer 6 — see `hasAbilities`. A silenced permanent replaces
        // nothing.
        if (!hasAbilities(state, oracle, scripts, sourceId)) continue;
        const key = own ? `${sourceId}#${def.abilityId}` : `${sourceId}#${script.oracleId}#${def.abilityId}`;
        if (used.has(key)) continue;
        if (!def.applies(readonlyCtx(state, oracle, scripts, cache), sourceId, ev)) continue;
        out.push({ key, sourceId, def });
      }
    }
  }
  // ⚠️ CR 614.12 (D318) — a permanent's OWN replacement effects that modify how it
  // enters ("enters with two +1/+1 counters") apply from its own abilities as it
  // enters, as though it were already on the battlefield. Until D318 the funnel
  // offered an event only to the battlefield's permanents, so a ReplacementDef on
  // the entering card itself never ran — the reason no shipped script carried
  // one. Offered AFTER the battlefield's, in move order; the same `used` key
  // keeps each def to one application per event (CR 614.5).
  if (ev.t === 'CardsMoved') {
    for (const move of ev.moves) {
      if (move.to.kind !== 'battlefield' || move.from.kind === 'battlefield') continue;
      const sourceId = move.card;
      if (state.zones.battlefield.includes(sourceId)) continue;
      const source = state.cards[sourceId];
      if (!source) continue;
      const script = scripts.get(source.oracleId);
      if (!script) continue;
      for (const def of script.replacements ?? []) {
        // D578 - the entering card's own replacements read the face it enters with (the move's, D155).
        if (!def.activeZones.includes('battlefield') || !defOnFace(def, move.faceIndex)) continue;
        if (!hasAbilities(state, oracle, scripts, sourceId)) continue;
        const key = `${sourceId}#${def.abilityId}`;
        if (used.has(key)) continue;
        if (!def.applies(readonlyCtx(state, oracle, scripts, cache), sourceId, ev)) continue;
        out.push({ key, sourceId, def });
      }
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
 * D587 - "This spell can't be countered." (CR 101.2: the can't wins), read in ONE place for the funnel below and the
 * executor's counter (effects.ts), so the two never disagree. A spell's own card: its face's line (D422) or, on a
 * permanent, its script's (D336). A spell COPY has no card but has the copied text (CR 707.2): its copied printing and
 * face (`copyOf`) - a ward trigger or a Counterspell meeting a copy of Abrupt Decay counters nothing. Never an ability.
 */
export function uncounterable(state: GameState, oracle: OracleDb, scripts: ScriptRegistry, victim: StackObject): boolean {
  const card = victim.card === null ? undefined : state.cards[victim.card];
  const of = victim.card === null ? victim.copyOf : card;
  if (of === undefined) return false;
  const printing = oracle.byPrinting(of.printingId);
  const oracleId = card !== undefined ? card.oracleId : printing?.oracleId;
  // D422 - a SPELL face carries the line itself (`OracleFace.cantBeCountered`); a permanent's is its script's.
  return (oracleId !== undefined && scripts.get(oracleId)?.cantBeCountered !== undefined) || (printing !== undefined && faceOf(printing, of.faceIndex).cantBeCountered);
}

/**
 * D336 - "This spell can't be countered." (CR 701.5a: countering it does
 * nothing.) A counter's events arrive as a batch - the `SpellCountered` and,
 * behind it, the move that would send the card off the stack - and every
 * emitter in the engine sends them through this funnel, so this is the one
 * place the rule is read: the counter is dropped, the move is dropped with it,
 * and a line says so. Runs on the state BEFORE the batch, where the spell is
 * still on the stack to be looked up.
 */
function withoutCountersOfTheUncounterable(state: GameState, oracle: OracleDb, scripts: ScriptRegistry, bodies: readonly EventBody[]): readonly EventBody[] {
  if (!bodies.some((b) => b.t === 'SpellCountered')) return bodies;
  const out = [...bodies];
  for (let i = 0; i < out.length; i++) {
    const ev = out[i];
    if (!ev || ev.t !== 'SpellCountered') continue;
    const victim = state.stack.find((s) => s.id === ev.stackId);
    // D587 - the executor's reading too (`uncounterable`): a spell COPY has the copied text (CR 707.2).
    if (!victim || !uncounterable(state, oracle, scripts, victim)) continue;
    out[i] = narrated(`${victim.label} can't be countered.`, victim.controller, victim.identity);
    for (let j = i + 1; j < out.length; j++) {
      const mv = out[j];
      if (!mv || mv.t !== 'CardsMoved') continue;
      const keep = mv.moves.filter((m) => !(m.card === victim.card && m.from.kind === 'stack'));
      if (keep.length === mv.moves.length) continue;
      if (keep.length === 0) out.splice(j, 1);
      else out[j] = { ...mv, moves: keep };
      break;
    }
  }
  return out;
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
  rawBodies: readonly EventBody[],
): FunnelResult {
  // D336 - the uncounterable rule, before anything else looks at the batch.
  // D382 - and CR 615 prevention with it: a shield is spent ONCE over the whole
  // batch, where `applyReplacements` sees one body at a time against a state
  // that does not advance between them and would let two damage events each
  // consume the same shield. D385 - the CONTINUOUS prevention abilities (a
  // `PreventionDef` on a battlefield permanent) are asked in the same walk,
  // which is why it takes the oracle and the registry now.
  let bodies = withoutPreventedDamage(state, oracle, scripts, withoutCountersOfTheUncounterable(state, oracle, scripts, rawBodies));
  const defs = scripts.replacements();
  const settled: EventBody[] = [];

  for (let i = 0; i < bodies.length; i++) {
    const body = bodies[i];
    if (!body) continue;
    // ⚠️ Built-ins FIRST and per body, against the state as it stands — which is
    // why the batch is walked here rather than flat-mapped up front. A built-in
    // asks about the board ("do you control two other lands"), and the answer
    // changes as the batch is applied.
    // D486 - a clone's move is held and asked about before this body's built-ins run (see `cloneChoiceFor`).
    const clone = cloneChoiceFor(state, oracle, scripts, body);
    if (clone !== null) {
      return {
        kind: 'ask',
        settled,
        pending: { event: body, player: clone.player, used: [], siblings: [], rest: [], queued: bodies.slice(i + 1), copyChoice: clone.copyChoice },
      };
    }
    // CR 903.9b - a commander's move to a hand or a library is held and asked about the same way (`commanderChoiceFor`).
    const home = commanderChoiceFor(state, body);
    if (home !== null) {
      return {
        kind: 'ask',
        settled,
        pending: { event: body, player: home.player, used: [], siblings: [], rest: [], queued: bodies.slice(i + 1), commanderChoice: { card: home.card } },
      };
    }
    const builtIn = applyReplacements(state, oracle, scripts, body);
    // D587 - a card a built-in took off its way into a library (903.9b's command zone, unearth's exile) is not in it: the
    // rest of the batch forgets the shuffle order and the draw it was counted in (`withoutDiverted`).
    if (body.t === 'CardsMoved' && body.moves.some((m) => m.to.kind === 'library')) {
      const kept = new Set(builtIn.flatMap((e) => (e.t === 'CardsMoved' ? e.moves.filter((m) => m.to.kind === 'library').map((m) => `${m.to.player ?? ''}|${m.card}`) : [])));
      const diverted = body.moves.filter((m) => m.to.kind === 'library' && !kept.has(`${m.to.player ?? ''}|${m.card}`));
      if (diverted.length > 0) bodies = [...bodies.slice(0, i + 1), ...withoutDiverted(bodies.slice(i + 1), diverted)];
    }
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

/**
 * The name a permanent LEAVING the battlefield face up goes by (the lines below). CR 708.9 reveals a face-down one to
 * every player as it moves, so it is named by its printed face - its derived name is empty (CR 708.2) - as sba.ts's
 * dies line names it; anything else by its derived name.
 */
function leavingName(state: GameState, oracle: OracleDb, scripts: ScriptRegistry, id: InstanceId): string {
  const card = state.cards[id];
  if (!card) return 'It';
  const printing = card.faceDown ? oracle.byPrinting(card.printingId) : undefined;
  return printing ? faceOf(printing, card.faceIndex).name : derive(state, oracle, scripts, id).name;
}

/**
 * D413 - "if that creature would die this turn, exile it instead": a move from the battlefield to a
 * graveyard of a card carrying the mark (`untilEndOfTurn[].exileIfDies`) goes to exile - its owner's,
 * as every graveyard move here is the owner's - and the log says so. Nothing else moves.
 */
function withExileInsteadOfDying(state: GameState, oracle: OracleDb, scripts: ScriptRegistry, events: readonly EventBody[]): EventBody[] {
  const marked = new Set(state.untilEndOfTurn.filter((e) => e.exileIfDies === true).map((e) => e.card));
  if (marked.size === 0) return [...events];
  const out: EventBody[] = [];
  for (const ev of events) {
    if (ev.t !== 'CardsMoved') { out.push(ev); continue; }
    const redirected: InstanceId[] = [];
    const moves = ev.moves.map((m) => {
      if (m.from.kind !== 'battlefield' || m.to.kind !== 'graveyard' || !marked.has(m.card)) return m;
      redirected.push(m.card);
      return { ...m, to: { kind: 'exile' as const, player: m.to.player } };
    });
    out.push(redirected.length === 0 ? ev : { ...ev, moves });
    for (const id of redirected) out.push(narrated(`${leavingName(state, oracle, scripts, id)} is exiled instead of dying.`, null));
  }
  return out;
}

/**
 * D448 - unearth's leave replacement (CR 702.84c): a move from the battlefield to anywhere but exile of an
 * `unearthed` object goes to its owner's exile instead, and the log says so. Nothing else moves.
 */
function withUnearthedLeavingToExile(state: GameState, oracle: OracleDb, scripts: ScriptRegistry, events: readonly EventBody[]): EventBody[] {
  const out: EventBody[] = [];
  for (const ev of events) {
    if (ev.t !== 'CardsMoved') { out.push(ev); continue; }
    const redirected: InstanceId[] = [];
    const moves = ev.moves.map((m) => {
      if (m.from.kind !== 'battlefield' || m.to.kind === 'exile' || state.cards[m.card]?.unearthed !== true) return m;
      redirected.push(m.card);
      return { ...m, to: { kind: 'exile' as const, player: state.cards[m.card]?.owner ?? m.to.player } };
    });
    out.push(redirected.length === 0 ? ev : { ...ev, moves });
    for (const id of redirected) out.push(narrated(`${leavingName(state, oracle, scripts, id)} was unearthed: it is exiled instead.`, null));
  }
  return out;
}

/**
 * D541 - MADNESS (CR 702.35a): a card with madness its owner discards is exiled instead of put into the graveyard - still
 * a discard (the move keeps its reason, so a discard watcher sees it), marked `madness` for the trigger. Nothing else moves.
 */
function withMadnessToExile(state: GameState, oracle: OracleDb, events: readonly EventBody[]): EventBody[] {
  return events.map((ev) => {
    if (ev.t !== 'CardsMoved') return ev;
    let changed = false;
    const moves = ev.moves.map((m) => {
      if ((m.reason !== 'discard' && m.reason !== 'cycling') || m.from.kind !== 'hand' || m.to.kind !== 'graveyard') return m;
      const inst = state.cards[m.card];
      const printing = inst ? oracle.byPrinting(inst.printingId) : undefined;
      if (!inst || !printing || faceOf(printing, 0).madnessCost === null) return m;
      changed = true;
      return { ...m, to: { kind: 'exile' as const, player: inst.owner }, madness: true as const };
    });
    return changed ? { ...ev, moves } : ev;
  });
}

/**
 * D587 - A CARD TAKEN OFF ITS WAY INTO A LIBRARY IS NOT IN IT (CR 903.9b, 614.1). An effect that puts cards into a library
 * and shuffles works the order out - a wheel its draws too - on a scratch state where they arrived (ManualMoveZone's
 * shuffle, the D510 wheel, shuffleSelf, Oblation, a spell's own shuffle fate), and `LibraryShuffled` SETS the library to
 * it. When a replacement sends one of them elsewhere (903.9b's command zone, unearth's exile) or a held move's answer drops
 * a move gone stale, the later bodies of the batch forget it: the order without it, and a move of it OUT of that library
 * - a draw off the stale order - dropped with the draw's marker, until a later move puts it there after all. Else the card
 * sat in the library and where it went at once (the review's F2).
 */
export function withoutDiverted(bodies: readonly EventBody[], diverted: readonly CardMove[]): EventBody[] {
  const gone = new Set(diverted.flatMap((m) => (m.to.kind === 'library' && m.to.player !== null ? [`${m.to.player}|${m.card}`] : [])));
  if (gone.size === 0) return [...bodies];
  const out: EventBody[] = [];
  for (const b of bodies) {
    if (b.t === 'LibraryShuffled') {
      const order = b.order.filter((id) => !gone.has(`${b.player}|${id}`));
      out.push(order.length === b.order.length ? b : { ...b, order });
    } else if (b.t === 'CardsMoved') {
      const moves = b.moves.filter((m) => !(m.from.kind === 'library' && gone.has(`${m.from.player ?? ''}|${m.card}`)));
      for (const m of moves) if (m.to.kind === 'library') gone.delete(`${m.to.player ?? ''}|${m.card}`);
      if (moves.length > 0) out.push(moves.length === b.moves.length ? b : { ...b, moves });
    } else if (b.t === 'DrewCards') {
      const cards = b.cards.filter((id) => !gone.has(`${b.player}|${id}`));
      if (cards.length > 0) out.push(cards.length === b.cards.length ? b : { ...b, cards });
    } else {
      out.push(b);
    }
  }
  return out;
}

/**
 * CR 903.9b - a commander that would be put into its owner's hand or library from anywhere may be put into the command
 * zone instead. A REPLACEMENT, so the move is rewritten before it happens and the commander never touches the hand or
 * the library: the standing answer (the game's option, or the owner's "always do this") rewrites it here; with none, the
 * funnel has already held the move and asked (`commanderChoiceFor`), and a declined move carries `homeDeclined`.
 *
 * ⚠️ **NOT A GRAVEYARD OR EXILE, SINCE THE 2020 RULE (903.9a).** Those moves happen - the commander dies or is exiled, and
 * every trigger watching that sees it - and the owner's choice is a state-based action afterwards (704.6d, `sba.ts`).
 * This built-in used to rewrite them too, so a commander under "always" never died: Blood Artist, a haunt and every
 * other dies trigger missed it (the D583 review's find).
 */
function commanderZoneReplacement(state: GameState, moves: readonly CardMove[]): EventBody[] {
  const mode = state.options.commanderZoneReplacement;
  if (mode === 'never') return [{ t: 'CardsMoved', moves }];
  const said: EventBody[] = [];
  const rewritten = moves.map((move): CardMove => {
    if (!commanderWouldGoHome(state, move)) return move;
    const owner = state.cards[move.card]?.owner;
    const seat = owner === undefined ? undefined : state.players[owner];
    if (owner === undefined || (mode !== 'always' && seat?.commanderZoneAlways !== true)) return move;
    said.push(narrated(n`${who(state, owner)} ${vb(owner, 'puts', 'put')} ${their(owner)} commander into the command zone instead.`, owner));
    return { card: move.card, from: move.from, to: { kind: 'command', player: owner } };
  });
  return said.length === 0 ? [{ t: 'CardsMoved', moves }] : [{ t: 'CardsMoved', moves: rewritten }, ...said];
}

/**
 * CR 903.9b - a move that would put a commander (never a token) into a hand or a library from any other zone, not yet
 * answered. Not a move out of the command zone: that is the owner's own doing (Command Beacon), and replacing it would
 * undo it.
 *
 * ⚠️ **NOT A MERGED PERMANENT, a known gap.** Its cards leave together to one kind of zone (D581, the reducer's merged
 * walk), so the commander among them cannot be sent elsewhere by rewriting the one move: it goes to the hand or the
 * library with the rest, and the owner's way home is the Tier-3 move. (Its graveyard and exile are 903.9a's, and the
 * reducer marks a merged commander there like any other.)
 */
function commanderWouldGoHome(state: GameState, move: CardMove): boolean {
  if (move.to.kind !== 'hand' && move.to.kind !== 'library') return false;
  // D587 - nor a backed-out cast's undo (`CardMove.reversal`): the card goes back as it was, and no replacement applies.
  if (move.from.kind === move.to.kind || move.from.kind === 'command' || move.homeDeclined === true || move.reversal === true) return false;
  const card = state.cards[move.card];
  return !!card && card.isCommander && !card.isToken && card.merged === undefined;
}

/**
 * CR 903.9b - THE COMMANDER ASKS FIRST (D486's held-move shape). A move that would put a commander into its owner's hand
 * or library, with no standing answer (the 'ask' option, and no "always do this" yet), is HELD before this body's
 * built-ins run: the owner answers before the move happens, and the answer rewrites it (`commanderZoneChoice` in
 * handlers.ts). One commander a question - the answer re-runs the body, and the next one asks. A seat out of the game is
 * not asked.
 *
 * ⚠️ D61: `Awaiting` crosses the wire whole. A move between two hidden zones (a commander its owner once left in the
 * library, drawn; one left in the hand, put back) is asked about too, as the rule says, so the table learns that the card
 * is the commander - the one case where this question names a card in a hidden zone. Reaching it needs the owner to have
 * let the commander into the hand or the library before, and its identity is public anyway; said here rather than
 * redacted.
 */
function commanderChoiceFor(state: GameState, body: EventBody): { player: PlayerId; card: InstanceId } | null {
  if (body.t !== 'CardsMoved' || state.options.commanderZoneReplacement !== 'ask') return null;
  for (const move of body.moves) {
    if (!commanderWouldGoHome(state, move)) continue;
    const owner = state.cards[move.card]?.owner;
    const seat = owner === undefined ? undefined : state.players[owner];
    if (owner === undefined || !seat || seat.hasLost || seat.commanderZoneAlways !== null) continue;
    return { player: owner, card: move.card };
  }
  return null;
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
function enteringFace(oracle: OracleDb, move: CardMove, card: CardInstance, printing: OracleCard) {
  // D486 - a card entering AS A COPY arrives as the copied card's face (CR 707.9): every entry rule reads that one -
  // the copied card's loyalty, its `enters tapped`, its entry choice - never the clone's own.
  if (move.asCopyOf !== undefined) {
    const copied = oracle.byPrinting(move.asCopyOf.printingId);
    if (copied) return faceOf(copied, move.asCopyOf.faceIndex);
  }
  return faceOf(printing, move.faceIndex ?? card.faceIndex);
}

/**
 * D486 - what a clone may copy: the permanents (or graveyard cards) the face's noun admits, in the scope it names, the
 * clone itself excluded. ONE reader for the funnel's question and the handler's check (D139). A battlefield object is
 * asked by its DERIVED characteristics (an animated land is a creature; a face-down object is nothing to copy, CR
 * 708.2); a graveyard card by its printed face.
 */
export function copyCandidates(state: GameState, oracle: OracleDb, scripts: ScriptRegistry, controller: PlayerId, self: InstanceId, spec: EntersAsCopy): InstanceId[] {
  const cache = makeDeriveCache(state);
  const admits = (id: InstanceId): boolean => {
    const inst = state.cards[id];
    if (!inst || id === self) return false;
    if (spec.scope === 'you' && inst.controller !== controller) return false;
    if (spec.scope === 'opponent' && inst.controller === controller) return false;
    if (inst.zone.kind === 'battlefield') {
      if (inst.faceDown) return false;
      return predicateAdmits(derive(state, oracle, scripts, id, cache), spec.predicates);
    }
    const printing = oracle.byPrinting(inst.printingId);
    return printing !== undefined && predicateAdmits(faceOf(printing, inst.faceIndex), spec.predicates);
  };
  if (spec.zone === 'graveyard') return state.seating.flatMap((p) => (state.zones.graveyard[p] ?? []).filter(admits));
  return inPlay(state).filter(admits);
}

/**
 * D486 - THE CLONE ASKS FIRST (CR 707.9). A move that puts a card whose face says `You may have ~ enter as a copy of
 * <noun>` onto the battlefield is HELD before this body's built-ins run: the copy is decided before the object exists
 * there, so the copied card's own entry rules and enters triggers are the ones that run. A move already decided (its
 * `asCopyOf` set, or `copyDeclined`) is not asked again; a board with nothing the noun admits asks nothing and the card
 * enters as itself (a question with no legal answer, D137); a seat out of the game is not asked.
 */
function cloneChoiceFor(state: GameState, oracle: OracleDb, scripts: ScriptRegistry, body: EventBody): { player: PlayerId; copyChoice: NonNullable<PendingReplacement['copyChoice']> } | null {
  if (body.t !== 'CardsMoved') return null;
  for (const move of body.moves) {
    if (move.to.kind !== 'battlefield' || move.from.kind === 'battlefield' || move.faceDown === true || move.asCopyOf !== undefined || move.copyDeclined === true) continue;
    const card = state.cards[move.card];
    if (!card) continue;
    const printing = oracle.byPrinting(card.printingId);
    if (!printing) continue;
    const spec = faceOf(printing, move.faceIndex ?? card.faceIndex).entersAsCopy;
    if (!spec) continue;
    const controller = move.to.player ?? card.controller ?? card.owner;
    const seat = state.players[controller];
    if (!seat || seat.hasLost) continue;
    if (copyCandidates(state, oracle, scripts, controller, move.card, spec).length === 0) continue;
    return { player: controller, copyChoice: { card: move.card, exceptions: spec.exceptions, tapped: spec.tapped } };
  }
  return null;
}

/**
 * D486 - the question a suspended funnel asks: the clone's choice when the record carries one (the candidates re-read
 * off the board by the one reader), the CR 616 order otherwise.
 */
export function askPromptFor(state: GameState, oracle: OracleDb, scripts: ScriptRegistry, pending: PendingReplacement): Awaiting {
  // CR 903.9b - the commander's question: where it sits, and the hand or library it would be put into instead.
  const hc = pending.commanderChoice;
  if (hc !== undefined) {
    const move = pending.event.t === 'CardsMoved' ? pending.event.moves.find((m) => m.card === hc.card) : undefined;
    const from = move?.from ?? state.cards[hc.card]?.zone ?? { kind: 'command' as const, player: pending.player };
    return { kind: 'commanderZoneChoice', player: pending.player, queue: [{ player: pending.player, card: hc.card, from }], ...(move ? { instead: move.to } : {}) };
  }
  const cc = pending.copyChoice;
  if (cc !== undefined) {
    const card = state.cards[cc.card];
    const printing = card ? oracle.byPrinting(card.printingId) : undefined;
    const move = pending.event.t === 'CardsMoved' ? pending.event.moves.find((m) => m.card === cc.card) : undefined;
    const face = card && printing ? faceOf(printing, move?.faceIndex ?? card.faceIndex) : undefined;
    const spec = face?.entersAsCopy ?? null;
    const candidates = card && spec ? copyCandidates(state, oracle, scripts, pending.player, cc.card, spec) : [];
    return { kind: 'chooseCopy', player: pending.player, source: cc.card, candidates, optional: true, what: spec?.what ?? 'a permanent', label: face?.name ?? 'the permanent' };
  }
  return { kind: 'chooseReplacement', player: pending.player, options: replacementOptions(state, oracle, scripts, pending) };
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
      const face = enteringFace(oracle, move, card, printing);
      const { baseLoyalty, baseDefense } = face;
      if (baseLoyalty !== null && baseLoyalty > 0 && face.typeLine.types.includes('Planeswalker')) {
        changes.push({ card: move.card, kind: 'loyalty', delta: baseLoyalty });
      }
      if (baseDefense !== null && baseDefense > 0 && face.typeLine.types.includes('Battle')) {
        changes.push({ card: move.card, kind: 'defense', delta: baseDefense });
      }
      // D440 - modular N (CR 702.43a): the creature enters with N +1/+1 counters, the number off the printed line.
      if (face.keywords.includes('modular')) {
        const n = Number(/\bmodular (\d+)\b/i.exec(face.oracleText)?.[1] ?? '0');
        if (n > 0) changes.push({ card: move.card, kind: '+1/+1', delta: n });
      }
      // D565 - SUNBURST (CR 702.44a): a counter for each colour of mana spent to cast it, the count the move carries off
      // the resolving spell (a permanent not cast carries none): +1/+1 if it enters as a creature, charge otherwise.
      if (face.keywords.includes('sunburst') && (move.sunburst ?? 0) > 0) {
        changes.push({ card: move.card, kind: face.typeLine.types.includes('Creature') ? '+1/+1' : 'charge', delta: move.sunburst ?? 0 });
      }
      // D568 - ESCAPE (CR 702.138c): an escaped permanent enters with the counters its `escapes with` line names.
      if (move.escaped === true && face.escapesWith !== null) changes.push({ card: move.card, kind: '+1/+1', delta: face.escapesWith.counters });
      // D450 - vanishing N / fading N (CR 702.63a, 702.32a): N time / fade counters as it enters.
      if (face.keywords.includes('vanishing')) {
        const n = Number(/\bvanishing (\d+)\b/i.exec(face.oracleText)?.[1] ?? '0');
        if (n > 0) changes.push({ card: move.card, kind: 'time', delta: n });
      }
      if (face.keywords.includes('fading')) {
        const n = Number(/\bfading (\d+)\b/i.exec(face.oracleText)?.[1] ?? '0');
        if (n > 0) changes.push({ card: move.card, kind: 'fade', delta: n });
      }
      // D528 - CR 714.2a: a Saga enters with a lore counter; its first chapter triggers off this very change (the
      // chapter defs read the count before and after on `CountersChanged`).
      if (face.typeLine.subtypes.includes('Saga')) changes.push({ card: move.card, kind: 'lore', delta: 1 });
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
  const asking: { card: InstanceId; player: PlayerId; life: number; label: string; reveal?: { any: readonly PermanentPredicate[]; text: string }; option?: 'unleash' | 'riot'; devour?: { n: number; candidates: readonly InstanceId[] } }[] = [];
  for (const ev of events) {
    if (ev.t !== 'CardsMoved') continue;
    for (const move of ev.moves) {
      if (move.to.kind !== 'battlefield' || move.from.kind === 'battlefield') continue;
      if (move.faceDown) continue;
      const card = state.cards[move.card];
      if (!card) continue;
      const printing = oracle.byPrinting(card.printingId);
      if (!printing) continue;
      const face = enteringFace(oracle, move, card, printing);
      // D444 - THE ENTRY CHOICES (CR 702.98 / 702.132): a creature entering with unleash or riot asks its controller
      // - a +1/+1 counter, or nothing / haste. The printed keywords, read the way `entersTapped` is: the object is
      // not on the battlefield yet, so there is nothing to derive. A seat out of the game is not asked.
      const option = face.keywords.includes('riot') ? 'riot' : face.keywords.includes('unleash') ? 'unleash' : null;
      if (option !== null) {
        const chooser = move.to.player ?? card.controller ?? card.owner;
        const seat = state.players[chooser];
        if (seat && !seat.hasLost) asking.push({ card: move.card, player: chooser, life: 0, label: face.name, option });
      }
      // D570 - DEVOUR N (CR 702.82a): the controller may sacrifice any number of creatures as it enters, N +1/+1 counters
      // for each. The candidates are read HERE, off the board before the move - so neither the devourer nor a creature
      // entering beside it can be eaten - and no candidate is no question. A seat out of the game is not asked.
      if (face.keywords.includes('devour')) {
        const n = parseDevour(face.oracleText);
        const chooser = move.to.player ?? card.controller ?? card.owner;
        const seat = state.players[chooser];
        if (n !== null && seat && !seat.hasLost) {
          const candidates = devourCandidates(state, oracle, scripts, chooser, events);
          if (candidates.length > 0) asking.push({ card: move.card, player: chooser, life: 0, label: face.name, devour: { n, candidates } });
        }
      }
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
          // D441 - a reveal price is asked only of a player whose hand HOLDS a card the noun admits (the same
          // rule as the life: nothing to show is no question, the land enters tapped). Read off the printed
          // faces - a hand card has no derived characteristics.
          if (unless.kind === 'reveal') {
            const holds = seat !== undefined && !seat.hasLost && (state.zones.hand[controller] ?? []).some((id) => revealAdmits(state, oracle, id, unless.any));
            if (holds) {
              asking.push({ card: move.card, player: controller, life: 0, label: face.name, reveal: { any: unless.any, text: unless.text } });
              continue;
            }
          } else if (seat && !seat.hasLost && seat.life >= unless.life) {
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
        ...(head.reveal !== undefined ? { reveal: head.reveal } : {}),
        ...(head.option !== undefined ? { option: head.option } : {}),
        ...(head.devour !== undefined ? { devour: head.devour } : {}),
        queue: asking.slice(1),
      },
    });
  }
  return out;
}

/**
 * D570 - the creatures a devourer entering under `player` may sacrifice: theirs on the battlefield now (the board before
 * the move, derived with the real registry), none that this batch moves off it.
 */
function devourCandidates(state: GameState, oracle: OracleDb, scripts: ScriptRegistry, player: PlayerId, events: readonly EventBody[]): InstanceId[] {
  const leaving = new Set<InstanceId>();
  for (const ev of events) {
    if (ev.t !== 'CardsMoved') continue;
    for (const m of ev.moves) if (m.from.kind === 'battlefield' && m.to.kind !== 'battlefield') leaving.add(m.card);
  }
  const cache = makeDeriveCache(state);
  return inPlay(state).filter((id) => state.cards[id]?.controller === player && !leaving.has(id) && derive(state, oracle, scripts, id, cache).isCreature);
}

/** D441 - does this hand card's printed face satisfy a reveal land's noun? (One reader: `predicateAdmits`, D389.) */
export function revealAdmits(state: GameState, oracle: OracleDb, id: InstanceId, any: readonly PermanentPredicate[]): boolean {
  const inst = state.cards[id];
  const printing = inst ? oracle.byPrinting(inst.printingId) : undefined;
  if (!inst || !printing) return false;
  const face = faceOf(printing, inst.faceIndex);
  return predicateAdmits({ typeLine: face.typeLine, colors: face.colors }, any);
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
// D342 - exported for `activationConditions.ts`: the same evaluator answers "Activate only if you control ...".
export function conditionHolds(
  state: GameState,
  oracle: OracleDb,
  scripts: ScriptRegistry,
  condition: Exclude<EntersTappedCondition, { kind: 'payLife' | 'reveal' }>,
  controller: PlayerId,
): boolean {
  const cache = makeDeriveCache(state);
  const mine = inPlay(state).filter((id) => state.cards[id]?.controller === controller);
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
        inPlay(state).filter((id) => {
          const c = state.cards[id];
          return !!c && c.controller !== controller && d(id).isLand;
        }).length >= condition.count
      );
    // D621 - FEROCIOUS: one of the controller's creatures with at least that much DERIVED power.
    case 'creaturePower':
      return mine.some((id) => {
        const chars = d(id);
        return chars.isCreature && (chars.power ?? Number.NEGATIVE_INFINITY) >= condition.power;
      });
    // D621 - an opponent with more lands than the controller (any one of them).
    case 'opponentMoreLands': {
      const lands = (p: PlayerId): number => inPlay(state).filter((id) => state.cards[id]?.controller === p && d(id).isLand).length;
      const own = lands(controller);
      return livingPlayers(state).some((p) => p !== controller && lands(p) > own);
    }
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
/**
 * D470 - THE STUN COUNTER (CR 122.1j). Every card in the untap that carries a stun counter is held back and
 * loses one counter; the rest untap as the event said. An untap that held only stunned permanents becomes
 * the counter changes alone.
 */
function withStunCounters(state: GameState, oracle: OracleDb, ev: Extract<EventBody, { t: 'PermanentsUntapped' }>): EventBody[] {
  const stunned = ev.cards.filter((id) => (state.cards[id]?.counters['stun'] ?? 0) > 0);
  if (stunned.length === 0) return [ev];
  const rest = ev.cards.filter((id) => !stunned.includes(id));
  const out: EventBody[] = rest.length > 0 ? [{ ...ev, cards: rest }] : [];
  for (const id of stunned) {
    out.push({ t: 'CountersChanged', changes: [{ card: id, kind: 'stun', delta: -1 }] });
    const card = state.cards[id];
    const printing = card ? oracle.byPrinting(card.printingId) : undefined;
    // A face-down creature is named as the table sees it (CR 708.5) - never by its printed face, in the one shared log.
    const name = card?.faceDown ? 'A face-down creature' : card && printing ? faceOf(printing, card.faceIndex).name : 'It';
    out.push(narrated(`${name} stays tapped: a stun counter is removed instead.`, card?.controller ?? null));
  }
  return out;
}

/**
 * D577 - DAYBOUND (CR 702.145b): "If it is night, this permanent enters the battlefield transformed" - a card whose front
 * face is daybound moving onto the battlefield at night arrives back face up (the move's face, D155). A face-down move and a
 * copy entry are left alone.
 */
function withNightEntry(state: GameState, oracle: OracleDb, events: readonly EventBody[]): EventBody[] {
  if (state.dayNight !== 'night') return [...events];
  return events.map((e) => {
    if (e.t !== 'CardsMoved') return e;
    let changed = false;
    const moves = e.moves.map((m) => {
      if (m.to.kind !== 'battlefield' || m.faceDown === true || m.asCopyOf !== undefined || (m.faceIndex ?? 0) !== 0) return m;
      const card = state.cards[m.card];
      const printing = card ? oracle.byPrinting(card.printingId) : undefined;
      if (!printing || printing.faces.length < 2 || !faceOf(printing, 0).keywords.includes('daybound')) return m;
      changed = true;
      return { ...m, faceIndex: 1 };
    });
    return changed ? { ...e, moves } : e;
  });
}

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
const STEP_INDEX_MAP = new Map(STEP_ORDER.map((s, i) => [s.step, i]));
const STEP_INDEX = (step: Step): number => STEP_INDEX_MAP.get(step) ?? 0;

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
      // D581 - A MERGED PERMANENT fires every card's triggers (CR 702.140e): the host is indexed under each card merged
      // under its top one as well - after its own, so the order of everything else is unchanged.
      const host = state.cards[id];
      if (host?.merged !== undefined) {
        for (const part of mergedUnder(state, host)) {
          const also = m.get(part.oracleId);
          if (also) also.push(id);
          else m.set(part.oracleId, [id]);
        }
      }
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
        if (!card || card.phasedOut) continue;
        if (!def.activeZones.includes(card.zone.kind) || !defOnFace(def, card.faceIndex)) continue;
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
          // D428 - the triggering player: named off the event (and the item); a head that named nobody fires nothing.
          const player = def.playerOf ? def.playerOf(ctx, id, event.body, item) : undefined;
          if (def.playerOf && player === null) continue;
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
            // D343 - a modal trigger's modes ride the same way, for the same reason.
            ...(def.modes && def.modes.length > 0 ? { modes: def.modes, modeChoice: def.modeChoice ?? { min: 1, max: 1 } } : {}),
            ...(item !== undefined ? { item } : {}),
            ...(player !== undefined && player !== null ? { player } : {}),
            // D476 - the head's own number (the damage this source dealt), read off the event as the trigger fires.
            ...(def.memo ? { memo: def.memo(ctx, id, event.body, item) } : {}),
            // D474 - a token's trigger carries its printing: the instance may have ceased before the aim (CR 603.10).
            ...(card.isToken ? { lki: { printingId: card.printingId, faceIndex: card.faceIndex } } : {}),
            // D612 - a looks-back trigger carries its source's counters as it last existed (the board before the move).
            ...(look && Object.keys(card.counters).length > 0 ? { sourceCounters: { ...card.counters } } : {}),
          });
        }
      }
    }
  }
  // D485 - A CREATED TOKEN ENTERS (CR 603.6a). `TokenCreated` IS the token's entry, but its own script's enters
  // triggers are `CardsMoved` defs (a def declares one event kind), so a token copy of Wall of Omens never drew. The
  // token's OWN defs are offered an ENTRY VIEW of the creation - the move every enters trigger matches (`to` the
  // battlefield from elsewhere) - and nothing else sees the view: a watcher of others' entries listens to
  // `TokenCreated` itself (Ajani's Welcome). The view is never applied or logged; its `from` is spelled exile, a zone
  // no shipped matcher reads an entry from. Offered after the printed walk, before the granted one, so the firing
  // order stays what it was for everything that fired before.
  for (const event of applied) {
    if (event.body.t !== 'TokenCreated') continue;
    const id = event.body.card;
    const card = after.cards[id];
    if (!card || card.zone.kind !== 'battlefield' || card.phasedOut) continue;
    const script = scripts.get(card.oracleId);
    if (!script) continue;
    const view: EventBody = { t: 'CardsMoved', moves: [{ card: id, from: { kind: 'exile', player: card.owner }, to: { kind: 'battlefield', player: null } }] };
    const ctx = ctxOf(false);
    for (const def of script.triggers ?? []) {
      if (def.event !== 'CardsMoved' || def.looksBack === true) continue;
      if (!def.activeZones.includes('battlefield') || !defOnFace(def, card.faceIndex)) continue;
      if (!hasAbilities(after, oracle, scripts, id)) continue;
      if (!def.matches(ctx, id, view)) continue;
      const items: readonly (InstanceId | undefined)[] = def.perItem ? def.perItem(ctx, id, view) : [undefined];
      for (const item of items) {
        const player = def.playerOf ? def.playerOf(ctx, id, view, item) : undefined;
        if (def.playerOf && player === null) continue;
        out.push({
          id: `t${n++}`,
          source: id,
          controller: card.controller,
          abilityRef: `${script.oracleId}#${def.abilityId}`,
          label: def.label(ctx, id, view),
          optional: def.optional,
          specs: def.targets ?? [],
          ...(def.modes && def.modes.length > 0 ? { modes: def.modes, modeChoice: def.modeChoice ?? { min: 1, max: 1 } } : {}),
          ...(item !== undefined ? { item } : {}),
          ...(player !== undefined && player !== null ? { player } : {}),
          ...(def.memo ? { memo: def.memo(ctx, id, view, item) } : {}),
          lki: { printingId: card.printingId, faceIndex: card.faceIndex },
        });
      }
    }
  }
  // ⚠️ D368 - THE GRANTED-TRIGGER SEAM, the other half of D367's carrier. A
  // permanent may HAVE a triggered ability because another permanent's layer-6
  // static installed it (`Enchanted creature has "Whenever this creature attacks,
  // ..."`). The def lives on the PROVIDER's script and fires off the RECIPIENT, so
  // the per-oracleId index every printed trigger uses cannot reach it: the registry
  // holds a second index BY REF, and that index is also the gate - it is empty for
  // every game carrying no grant, and the walk below is skipped entirely rather
  // than deriving each permanent for each event.
  //
  // ⚠️ THE RECIPIENT IS THE SOURCE (CR 113.7a), exactly as in the activated half:
  // `source` is the permanent the grant landed on, `controller` is ITS controller,
  // and `label`/`matches`/`targets` are asked with the recipient's id - so "this
  // creature" and "you" in the quoted body mean the recipient and its controller.
  const grantIndex = scripts.grantedTriggerDefs();
  if (grantIndex.size > 0) {
    // ⚠️ THE SAME TWO GATES THE PRINTED WALK HAS, AND FOR THE SAME REASON.
    // `grantIndex.size > 0` was the whole gate, and it is TRUE for every game
    // from the moment the first `gt` def ships - so the walk below derived every
    // battlefield permanent TWICE PER EVENT, for events no granted def can even
    // match, because the `def.event` check sits inside the derive. Measured as a
    // bot game taking 227 s. Gate on the event KIND first (the analogue of
    // `triggersFor`, D162), then on a PROVIDER being in this game at all (the
    // analogue of the present-def memo, D168): a grant reaches a permanent only
    // because a provider's static installed it, so with no provider instance
    // there is nothing to derive. Neither gate can change what is emitted, and
    // the loops below are untouched - so the firing ORDER, and the replay hash,
    // is unchanged.
    const grantKinds = new Set<EventBody['t']>();
    const grantProviders = new Set<string>();
    for (const { script, def } of grantIndex.values()) {
      grantKinds.add(def.event);
      grantProviders.add(script.oracleId);
    }
    const providerPresentMemo: (boolean | undefined)[] = [undefined, undefined];
    const providerPresent = (look: boolean): boolean => {
      const at = look ? 1 : 0;
      const got = providerPresentMemo[at];
      if (got !== undefined) return got;
      const idx = byOracle(look);
      let any = false;
      for (const oid of grantProviders) {
        if ((idx.get(oid)?.length ?? 0) > 0) {
          any = true;
          break;
        }
      }
      providerPresentMemo[at] = any;
      return any;
    };
    for (const event of applied) {
      if (!grantKinds.has(event.body.t)) continue;
      for (const look of [false, true]) {
        if (!providerPresent(look)) continue;
        const state = look ? before : after;
        const ctx = ctxOf(look);
        for (const id of idsOf(look)) {
          const card = state.cards[id];
          if (!card || card.zone.kind !== 'battlefield' || card.phasedOut) continue;
          if (!hasAbilities(state, oracle, scripts, id)) continue;
          for (const g of ctx.derive(id).grantedTriggered) {
            const found = grantIndex.get(g.ref);
            if (!found) continue;
            const def = found.def;
            if (def.event !== event.body.t) continue;
            if ((def.looksBack === true) !== look) continue;
            if (!def.activeZones.includes(card.zone.kind)) continue;
            if (!def.matches(ctx, id, event.body)) continue;
            const items: readonly (InstanceId | undefined)[] = def.perItem ? def.perItem(ctx, id, event.body) : [undefined];
            for (const item of items) {
              // D428 - the triggering player, off the recipient's own firing.
              const player = def.playerOf ? def.playerOf(ctx, id, event.body, item) : undefined;
              if (def.playerOf && player === null) continue;
              out.push({
                id: `t${n++}`,
                source: id,
                controller: card.controller,
                abilityRef: g.ref,
                label: def.label(ctx, id, event.body),
                optional: def.optional,
                specs: def.targets ?? [],
                ...(def.modes && def.modes.length > 0 ? { modes: def.modes, modeChoice: def.modeChoice ?? { min: 1, max: 1 } } : {}),
                ...(item !== undefined ? { item } : {}),
                ...(player !== undefined && player !== null ? { player } : {}),
                // D477 - a granted def's memo rides its firing as a present def's does (D476).
                ...(def.memo ? { memo: def.memo(ctx, id, event.body, item) } : {}),
              });
            }
          }
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
      // D525 - an entry that fires off the SPELL ON THE STACK (cascade): the cast card alone is asked, off the state
      // after the cast (the card is on the stack), through its DERIVED keywords and CR 613's silence as a permanent
      // would be; one firing per item the entry names (a keyword line that prints `cascade` four times fires four).
      if (kt.fromStack === true) {
        if (event.body.t !== 'SpellCast' || event.body.obj.card === null) continue;
        const id = event.body.obj.card;
        const card = state.cards[id];
        if (!card || card.zone.kind !== 'stack') continue;
        if (!hasAbilities(state, oracle, scripts, id)) continue;
        if (!ctx.derive(id).keywords.has(kt.keyword ?? (keyword as Keyword))) continue;
        if (!kt.matches(ctx, id, event.body)) continue;
        const items: readonly (InstanceId | undefined)[] = kt.perItem ? kt.perItem(ctx, id, event.body) : [undefined];
        for (const item of items) {
          out.push({
            id: `t${n++}`,
            source: id,
            controller: card.controller,
            abilityRef: `${card.oracleId}#kw:${keyword}`,
            label: kt.label(ctx, id),
            optional: kt.optional === true,
            specs: kt.targets ? kt.targets(ctx, id) : [],
            ...(item !== undefined ? { item } : {}),
            ...(kt.memo ? { memo: kt.memo(ctx, id, event.body) } : {}),
            // D536 - the entry's own effects (storm's copies), onto the stack object as its `delayedEffects`.
            ...(kt.effects ? { effects: kt.effects(ctx, id, event.body) } : {}),
          });
        }
        continue;
      }
      // D541 - an entry that fires off a MOVED CARD (madness): the card a move of this event carried, where the move put
      // it, off the state after the event; no derived keyword is asked (the card is in exile - the entry's own `matches`
      // reads the move's mark). Its owner controls the trigger; the entry's effects ride as storm's do.
      if (kt.fromMove === true) {
        if (event.body.t !== 'CardsMoved') continue;
        for (const m of event.body.moves) {
          const card = state.cards[m.card];
          if (!card || card.zone.kind !== m.to.kind) continue;
          if (!kt.matches(ctx, m.card, event.body)) continue;
          out.push({
            id: `t${n++}`,
            source: m.card,
            // D544 - a permanent's entry is its controller's trigger (partner with); a card in another zone its owner's (madness).
            controller: card.zone.kind === 'battlefield' ? card.controller : card.owner,
            abilityRef: `${card.oracleId}#kw:${keyword}`,
            label: kt.label(ctx, m.card),
            optional: false,
            specs: kt.targets ? kt.targets(ctx, m.card) : [],
            ...(kt.effects ? { effects: kt.effects(ctx, m.card, event.body) } : {}),
          });
        }
        continue;
      }
      // D561 - an entry that fires off a card IN A GRAVEYARD (recover): every graveyard's cards, off the state the entry
      // looks at (before the event for a looks-back one), through the PRINTED face's keywords (a map lookup per card, since
      // every move walks the piles - nothing grants a graveyard card an ability here); the card's OWNER controls the trigger
      // (a card in a graveyard has no controller), one firing per item, the entry's effects riding as storm's do.
      if (kt.fromGraveyard === true) {
        const kw = kt.keyword ?? (keyword as Keyword);
        for (const pile of Object.values(state.zones.graveyard)) {
          for (const id of pile ?? []) {
            const card = state.cards[id];
            const printing = card ? oracle.byPrinting(card.printingId) : undefined;
            if (!card || !printing || card.zone.kind !== 'graveyard') continue;
            if (!faceOf(printing, card.faceIndex).keywords.includes(kw)) continue;
            if (!kt.matches(ctx, id, event.body)) continue;
            const items: readonly (InstanceId | undefined)[] = kt.perItem ? kt.perItem(ctx, id, event.body) : [undefined];
            for (const item of items) {
              out.push({
                id: `t${n++}`,
                source: id,
                controller: card.owner,
                abilityRef: `${card.oracleId}#kw:${keyword}`,
                label: kt.label(ctx, id),
                optional: false,
                // D583 - a graveyard entry may aim (haunt's exile of the resolved spell).
                specs: kt.targets ? kt.targets(ctx, id) : [],
                ...(item !== undefined ? { item } : {}),
                ...(kt.effects ? { effects: kt.effects(ctx, id, event.body) } : {}),
              });
            }
          }
        }
        continue;
      }
      // D583 - an entry that fires off a card IN EXILE (haunt's trigger from the creature it haunts): every exile pile's
      // cards, off the state the entry looks at (before the event for a looks-back one), through the PRINTED face's
      // keywords; the card's OWNER controls the trigger, its clauses and effects riding as storm's do.
      if (kt.fromExile === true) {
        const kw = kt.keyword ?? (keyword as Keyword);
        for (const pile of Object.values(state.zones.exile)) {
          for (const id of pile ?? []) {
            const card = state.cards[id];
            const printing = card ? oracle.byPrinting(card.printingId) : undefined;
            if (!card || !printing || card.zone.kind !== 'exile') continue;
            if (!faceOf(printing, card.faceIndex).keywords.includes(kw)) continue;
            if (!kt.matches(ctx, id, event.body)) continue;
            out.push({
              id: `t${n++}`,
              source: id,
              controller: card.owner,
              abilityRef: `${card.oracleId}#kw:${keyword}`,
              label: kt.label(ctx, id),
              optional: false,
              specs: kt.targets ? kt.targets(ctx, id) : [],
              ...(kt.effects ? { effects: kt.effects(ctx, id, event.body) } : {}),
            });
          }
        }
        continue;
      }
      for (const id of idsOf(look)) {
        const card = state.cards[id];
        if (!card || card.zone.kind !== 'battlefield' || card.phasedOut) continue;
        if (!hasAbilities(state, oracle, scripts, id)) continue;
        // D450 - the entry names the keyword that gates it (a keyword may carry two triggers under two keys).
        if (!ctx.derive(id).keywords.has(kt.keyword ?? (keyword as Keyword))) continue;
        if (!kt.matches(ctx, id, event.body)) continue;
        const items: readonly (InstanceId | undefined)[] = kt.perItem ? kt.perItem(ctx, id, event.body) : [undefined];
        for (const item of items) {
          out.push({
            id: `t${n++}`,
            source: id,
            controller: card.controller,
            abilityRef: `${card.oracleId}#kw:${keyword}`,
            label: kt.label(ctx, id),
            // D361 - a keyword trigger may be OPTIONAL (soulshift) and may TARGET,
            // and both ride exactly as a script def's do. ⚠️ The clauses are asked
            // of the entry HERE rather than stored on it, because a keyword's number
            // is read off the printed text and a soulshift 3 and a soulshift 8 are
            // the same table entry with different bounds.
            optional: kt.optional === true,
            specs: kt.targets ? kt.targets(ctx, id) : [],
            // D459 - a modal keyword trigger's modes ride like a def's (D343).
            ...(kt.modes ? { modes: kt.modes(ctx, id), modeChoice: kt.modeChoice ?? { min: 1, max: 1 } } : {}),
            ...(item !== undefined ? { item } : {}),
            // D440 - the entry's memo, read off the state it matched against (before, for a looks-back entry).
            ...(kt.memo ? { memo: kt.memo(ctx, id, event.body) } : {}),
          });
        }
      }
    }
    // D402 - THE DELAYED TRIGGERS (CR 603.7): an armed entry fires at the first matching step to
    // BEGIN after its arming - the same turn if that step is still ahead, else a later turn; `your
    // next upkeep` waits for the controller's own turn; an upkeep is always a LATER turn's (the
    // arming happened after this turn's). The entry leaves the list as the ability goes on the
    // stack (the reducer, on `AbilityPutOnStack` carrying `delayedEffects`).
    if (event.body.t === 'StepBegan') {
      const step = event.body.step;
      for (const d of after.delayedTriggers) {
        if (d.when.step !== step) continue;
        if (d.source === null) continue;
        if (d.when.whose === 'controller' && after.turn.activePlayer !== d.controller) continue;
        const later = after.turn.turnNumber > d.armedTurn;
        const ahead = after.turn.turnNumber === d.armedTurn && STEP_INDEX(step) > STEP_INDEX(d.armedStep);
        if (step === 'upkeep' ? !later : !(later || ahead)) continue;
        out.push({ id: `t${n++}`, source: d.source, controller: d.controller, abilityRef: d.id, label: d.label, optional: false, specs: [], delayed: d.id });
      }
    }
    // D584 - THE REFLEXIVE TRIGGER (CR 603.12): a payment's marker is one pending trigger - walked LAST, so no trigger id or
    // order before it moves; no zone gate (a resolution made it, whatever became of its source since); its clauses and
    // effects ride onto the stack as a keyword entry's do (D536), its clauses kept for 608.2b; a token's printing rides.
    if (event.body.t === 'ReflexiveTriggered') {
      const b = event.body;
      const card = after.cards[b.source] ?? before.cards[b.source];
      out.push({
        id: `t${n++}`,
        source: b.source,
        controller: b.controller,
        abilityRef: `${card?.oracleId ?? 'reflexive'}#reflexive`,
        label: b.label,
        optional: false,
        specs: b.specs,
        effects: b.effects,
        reflexive: true,
        ...(b.lki !== undefined ? { lki: b.lki } : {}),
        // D586 - a recoloured spell copy's colours (the copy is the source, CR 603.7d).
        ...(b.sourceColors !== undefined ? { sourceColors: b.sourceColors } : {}),
      });
    }
  }
  // WARD AGAINST A SPELL COPY (CR 702.21a). A copy is never cast, so the cast-time tax (`handlers.ts wardTaxFor` - D68's
  // deliberate simplification for a CAST spell) never reaches it: its ward TRIGGERS, the rule itself. Once a copy's targets
  // are settled (`copiesSettled`), each ward of each permanent it targets that an opponent of its controller controls - the
  // tax's own lookup (`wardsMet`) - fires one trigger, controlled by that permanent's controller and put on the stack above
  // the copy: counter it unless its controller pays (D369's prompt, `wardSpec`), the copy bound as its aim. Walked LAST, so
  // no trigger id or order before it moves: a batch that settles no copy aimed at a ward collects exactly what it did.
  for (const copyId of copiesSettled(before, applied)) {
    const copy = after.stack.find((o) => o.id === copyId);
    if (!copy || copy.copyOf === undefined || after.players[copy.controller]?.hasLost !== false) continue;
    const met = new Set<InstanceId>();
    for (const { permanent, wards } of wardsMet(after, oracle, scripts, copy.controller, copy.targets)) {
      // A permanent the copy targets twice becomes its target once.
      if (met.has(permanent)) continue;
      met.add(permanent);
      const card = after.cards[permanent];
      const printing = card ? oracle.byPrinting(card.printingId) : undefined;
      if (!card || !printing) continue;
      // A face-down creature's identity is hidden (CR 708.5): its disguise ward is named as the table sees it.
      const name = card.faceDown ? 'A face-down creature' : faceOf(printing, card.faceIndex).name;
      // One trigger per ward ability: a face printing a mana ward and a life ward derives them as one charge.
      const prices = wards.flatMap((w) => [...(w.wardCost !== null ? [{ cost: w.wardCost, life: 0 }] : []), ...(w.wardLife > 0 ? [{ cost: null, life: w.wardLife }] : [])]);
      for (const price of prices) {
        out.push({
          id: `t${n++}`,
          source: permanent,
          controller: card.controller,
          abilityRef: `${card.oracleId}#ward`,
          label: `${name} - ward`,
          optional: false,
          specs: [],
          effects: [wardSpec(price.cost, price.life)],
          bound: [{ kind: 'stack', id: copy.id }],
        });
      }
    }
  }
  // D492 - THE ONCE-PER-TURN RIDER (`This ability triggers only once each turn.`): a printed def marked `oncePerTurn`
  // triggers once per turn per source. A match already recorded this turn (`turn.triggered`, bumped as the pending
  // trigger is queued) or earlier in this very collection (two creatures entering at once) is not queued at all; the
  // one that is carries the mark the reducer records. Read off `after`: a batch that began a turn cleared the record.
  const seen = new Set<string>();
  return out.flatMap((t) => {
    const script = scripts.get(t.abilityRef.slice(0, t.abilityRef.indexOf('#')));
    const def = script?.triggers?.find((d) => `${script.oracleId}#${d.abilityId}` === t.abilityRef);
    if (def?.oncePerTurn !== true) return [t];
    const key = `${t.source}|${t.abilityRef}`;
    if ((after.turn.triggered[key] ?? 0) >= 1 || seen.has(key)) return [];
    seen.add(key);
    return [{ ...t, oncePerTurn: true as const }];
  });
}

/**
 * The spell copies whose targets this batch SETTLED - a copy is put on the stack with its final targets (CR 707.10c), and
 * that is when a permanent becomes its target. The engine makes the copy first and then asks (D487), so a copy is settled
 * either as it is made with no question about its targets (`SpellCopied` without its `forKind: 'copy'` prompt in the same
 * batch), or by the answer to that question, kept or new: `before` held the question and the batch's first `AwaitingSet`
 * clears it (both branches of `chooseCopyTargets`). The copy settled by the answer comes first: a storm or replicate answer
 * makes the next copy, and asks about it, in the same batch.
 */
function copiesSettled(before: GameState, applied: readonly GameEvent[]): StackId[] {
  const out: StackId[] = [];
  const held = before.priority.awaiting;
  const cleared = applied.find((e) => e.body.t === 'AwaitingSet');
  if (held?.kind === 'chooseTargets' && held.forKind === 'copy' && cleared?.body.t === 'AwaitingSet' && cleared.body.awaiting === null) out.push(held.stackId);
  for (const e of applied) {
    if (e.body.t !== 'SpellCopied') continue;
    const id = e.body.obj.id;
    const asked = applied.some((a) => a.body.t === 'AwaitingSet' && a.body.awaiting?.kind === 'chooseTargets' && a.body.awaiting.forKind === 'copy' && a.body.awaiting.stackId === id);
    if (!asked) out.push(id);
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
        inPlay(state).filter((id) => state.cards[id]?.controller === player),
      controllerOf: (id: InstanceId) => state.cards[id]?.controller ?? null,
      isOnBattlefield: (id: InstanceId) => state.cards[id]?.zone.kind === 'battlefield',
    },
    random: { below: () => 0, shuffled: <T,>(xs: readonly T[]) => xs },
    // D344 - the vocabulary payload resolves from the loop alone (a def's resolve): a static and a match never emit.
    vocabulary: () => {
      throw new Error('ScriptCtx.vocabulary is resolution-only: a static or a trigger match must not run effects');
    },
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
      const face = faceOf(printing, card.faceIndex);
      // D465 - the creature-type clause is asked the same way (a face prints at most one of the two).
      if (!face.choosesColorOnEntry && !face.choosesTypeOnEntry) continue;
      const player = move.to.player ?? card.controller ?? card.owner;
      // Two literals rather than one object with a computed kind: the awaiting pin reads the
      // constructions by their literal kind, and each of the two must keep a producer site.
      const awaiting: Awaiting = face.choosesColorOnEntry
        ? { kind: 'chooseColor', player, source: move.card, label: face.name }
        : { kind: 'chooseCreatureType', player, source: move.card, label: face.name };
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
