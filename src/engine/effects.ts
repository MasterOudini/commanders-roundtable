// Turning a parsed effect into EVENTS — the last step of "the spell actually
// does something".
//
// ⚠️ EVENTS ONLY, never a mutation. That is the same contract the card-script
// API states for itself: an effect returns what happened, and `apply` is the one
// function that changes state. It is also what keeps a resolving Lightning Bolt
// replayable — the log carries the outcome, not an instruction to recompute one.
//
// ⚠️ Called ONLY for a face whose `effectMode` is `auto`, i.e. every sentence of
// it was understood. A partly-understood card never reaches here; it becomes the
// prompt bar's one-click offer instead, marked manual in the log. See
// `effectParse.ts` for why half-executing is the failure that matters.

import { derive, type DeriveCache } from './derive';
import { shuffle, type RngState } from './rng';
import type { EngineDeps } from './loop';
import type { EventBody, MoveReason, ResolvedDamage } from './types/events';
import type { InstanceId, PlayerId } from './types/ids';
import { SELF_AIMED, type BoardScope, type CopyExceptions, type CounterKind, type DelayWhen, type EffectSpec, type LookFilter, type SearchQualifier } from './types/oracle';
import { predicateAdmits } from '../data/replacementParse';
import { suspendTickSpec } from '../data/effectParse';
import { modeSpecs } from './modes';
import { faceOf } from './oracle';
import { apply } from './reducer';
import { proliferateCandidates } from './proliferate';
import { exploreChain } from './explore';
import { conniveChain } from './connive';
import { countOf } from './count';
import type { Awaiting, DelayedTrigger, EffectContinuation, GameState, PendingAsks, PreventionShield, ShieldSourceFilter, StackObject, TargetChoice } from './types/state';
// Every line here has a CARD as its subject ("Lightning Bolt counters Negate."),
// so none of them changes person for the reader and none needs parts.
import { n, narrated, vb, who } from './narrate';
import { drawFromTop } from './setup';
import { buildPaymentProblem } from './mana';
import { castCostCandidates } from './legal';
import { freeCastCandidates, handChoiceCandidates } from './handChoice';
import { solveInputFor, suggestPayment } from './payment';
import { OTHER_PURPOSE } from './spend';
import type { PlayerId as Payer } from './types/ids';

/** The thing a clause is pointed at, already checked for still being there. */
type Aim =
  | { readonly kind: 'card'; readonly id: InstanceId; readonly controller: PlayerId; readonly owner: PlayerId }
  | { readonly kind: 'player'; readonly id: PlayerId }
  | { readonly kind: 'stack'; readonly id: string };

/** D418 - the clause with its amount (a pump's halves) multiplied by the count read at resolution. */
function scaledBy(effect: EffectSpec, count: number): EffectSpec {
  if (effect.kind === 'pump') return { ...effect, power: effect.power * count, toughness: effect.toughness * count };
  return { ...effect, amount: effect.amount * count };
}
function aimOf(state: GameState, choice: TargetChoice | undefined): Aim | null {
  if (!choice) return null;
  if (choice.kind === 'player') {
    return state.players[choice.id] && !state.players[choice.id]?.hasLost
      ? { kind: 'player', id: choice.id }
      : null;
  }
  if (choice.kind === 'stack') {
    return state.stack.some((s) => s.id === choice.id) ? { kind: 'stack', id: choice.id } : null;
  }
  const card = state.cards[choice.id];
  if (!card) return null;
  return { kind: 'card', id: choice.id, controller: card.controller, owner: card.owner };
}

/**
 * The picks clause `clause` of `obj`'s face is aimed at (D299): the entries of
 * `targets` the cast assigned to it when it recorded `targetSlots`, else the
 * one at `targets[clause]` — abilities, triggers, the assisted path and every
 * log written before slots existed, read exactly as before.
 */
function picksFor(obj: StackObject, clause: number): readonly TargetChoice[] {
  const slots = obj.targetSlots;
  if (slots !== undefined) return obj.targets.filter((_, k) => slots[k] === clause);
  const one = obj.targets[clause];
  return one === undefined ? [] : [one];
}

/**
 * Every event one resolving object's effects produce.
 *
 * ⚠️ A clause whose target has gone is SKIPPED, not guessed at. CR 608.2b only
 * fizzles the whole spell when EVERY target is illegal — a two-target spell that
 * lost one still resolves for the other, and the one that went is simply not
 * affected.
 */
export function effectEvents(
  state: GameState,
  deps: EngineDeps,
  obj: StackObject,
  effects: readonly EffectSpec[],
  cache?: DeriveCache,
): EventBody[] {
  return effectResult(state, deps, obj, effects, cache).events;
}

/**
 * The same thing, plus the RNG if any clause consumed randomness.
 *
 * ⚠️ **TWO ENTRY POINTS RATHER THAN ONE CHANGED SIGNATURE, and the reason is the
 * rule it protects.** The RNG advances ONLY through a recorded `rngAfter`
 * (`reducer.ts`), so a caller that took the events and dropped the `rng` would
 * replay to a DIFFERENT board than it played — silently, and only for the cards
 * that use randomness. Callers that cannot thread it keep the narrow function,
 * which is why `effectEvents` still exists and still returns an array; the ones
 * that can use this and are checked by `tsc`.
 */
/** D402 - the delay, in words, for the narration. */
function delayLabel(when: DelayWhen): string {
  if (when.step === 'endCombat') return 'at end of combat';
  const step = when.step === 'upkeep' ? 'upkeep' : 'end step';
  return when.whose === 'controller' ? `at the beginning of your next ${step}` : `at the beginning of the next ${step}`;
}

export function effectResult(
  state: GameState,
  deps: EngineDeps,
  obj: StackObject,
  effects: readonly EffectSpec[],
  cache?: DeriveCache,
  /** D484 - the frame beyond these clauses, carried onto a question they raise (a resumed frame's `outer`). */
  outer?: EffectContinuation,
): { events: EventBody[]; rng?: RngState } {
  const out: EventBody[] = [];
  // ⚠️ Threaded through the loop and returned ONCE at the end, never read from
  // `state` per clause: two clauses that each drew from `state.rng` would draw
  // the SAME numbers, because nothing between them advanced it.
  let rng: RngState | undefined;
  const controller = obj.controller;
  const source = obj.card ?? obj.source;
  // D426 - THE LIFE LEDGER: `state` is the snapshot before this batch (D295), so a second life event for the same
  // player in one resolution would carry a `to` computed from before the first. The ledger keeps the running total
  // - the damage this batch dealt to players included - so the log's `to` is right; the reducer applies the delta.
  const lifeLedger = new Map<PlayerId, number>();
  const lifeOf = (id: PlayerId): number => lifeLedger.get(id) ?? state.players[id]?.life ?? 0;
  const lifeChanged = (player: PlayerId, delta: number): EventBody => {
    const to = lifeOf(player) + delta;
    lifeLedger.set(player, to);
    return { t: 'LifeChanged', player, delta, to };
  };
  const dealt = (damages: readonly ResolvedDamage[]): EventBody => {
    for (const d of damages) if (d.target.kind === 'player' && d.applyAs !== 'poison') lifeLedger.set(d.target.id, lifeOf(d.target.id) - d.amount);
    return { t: 'DamageDealt', damages };
  };
  // One allocator for every instance this resolution creates. See `createToken`.
  let nextInstance = state.counters.instance;
  // D382 - one resolving object may put up more than one shield; the id must be
  // stable across a replay, so it is the object's own id and a sequence.
  let shieldSeq = 0;

  /**
   * D299 — ONE STEP PER (CLAUSE, PICK). A counted clause ("destroy up to two
   * target creatures") runs its body once per pick, a bare clause once, a
   * `self` clause once with no aim. A clause whose picks have all left runs
   * once as `missing` so the narration below still says so; an OPTIONAL
   * clause ("up to one") the player declared no target for is not missing
   * anything — it was legal to choose none — and is skipped without a word.
   */
  // D507 - `at`: a step spliced in as a clause runs (D494's objects, D504's player) carries the index of the clause it
  // came from, so a question it raises carries the clauses AFTER that one (the continuation) - a copy is not in
  // `effects`, and `indexOf` said -1, which made the continuation the whole list again.
  const steps: { effect: EffectSpec; aim: Aim | null; missing: boolean; at?: number }[] = [];
  for (let ei = 0; ei < effects.length; ei++) {
    const effect = effects[ei] as EffectSpec;
    // D423 - a kicked `instead` clause REPLACES the clause before it: the base is skipped on a kicked spell, and
    // the narration says so (D90); the instead clause is D403's kicked gate when the spell was not kicked.
    const next = effects[ei + 1];
    if (next?.kickedInstead && (obj.kicked ?? 0) > 0) {
      out.push(narrated(`${obj.label} was kicked — “${effect.text}” is replaced.`, obj.controller, obj.identity));
      continue;
    }
    // D432 - a payment whose PAYER is the target player but whose body names no target (Smothering Tithe's Treasure,
    // `you gain 2 life unless target player pays`): the payer is the object's first player target - a referent row's
    // injected pick (D428) - and the body aims at nobody. The body's own `self` must not route it below, where the aim
    // would be null and the payer with it.
    if (effect.kind === 'payOptional' && effect.pay?.who === 'targetPlayer' && effect.targetIndex === -1) {
      const who = obj.targets.find((t) => t.kind === 'player');
      const aim = who ? aimOf(state, who) : null;
      steps.push({ effect, aim, missing: aim === null });
      continue;
    }
    // D494 - a clause about THE PREVIOUS CLAUSE'S OBJECTS is planned aimless: its aims are read off what the clause
    // before it emitted, as it runs (below).
    if (effect.ofPrevious === true) {
      steps.push({ effect, aim: null, missing: false });
      continue;
    }
    // D504 - a clause done by THE PREVIOUS CLAUSE'S OBJECT'S CONTROLLER (or owner) is planned aimless too: the player is
    // read off the object the clause before acted on, as it runs (below).
    if (effect.ofPreviousPlayer !== undefined) {
      steps.push({ effect, aim: null, missing: false });
      continue;
    }
    if (effect.self) {
      if (SELF_AIMED.has(effect.kind)) {
        // D373 - the subject is the SOURCE: for a granted ability the recipient (CR 113.7a),
        // for a permanent's printed ability the permanent. A source that has left the
        // battlefield is a subject that is gone, and the clause says so exactly as it
        // says a lost target has - never a silent no-op (D90).
        const inst = source ? state.cards[source] : undefined;
        const aim: Aim | null =
          source && inst && inst.zone.kind === 'battlefield' ? { kind: 'card', id: source, controller: inst.controller, owner: inst.owner } : null;
        steps.push({ effect, aim, missing: aim === null });
      } else {
        steps.push({ effect, aim: null, missing: false });
      }
      continue;
    }
    const picks = picksFor(obj, effect.targetIndex);
    // D497 - a delayed fire's picks are the objects it was armed with (D494's aims): one that has left the battlefield
    // since is a different object now, or gone - skipped, and the narration below says so. A return reads its own zones.
    const aims = picks
      .map((c) => aimOf(state, c))
      .filter((a): a is Aim => a !== null && !(obj.delayedEffects !== undefined && a.kind === 'card' && effect.kind !== 'returnObj' && state.cards[a.id]?.zone.kind !== 'battlefield'));
    if (aims.length === 0) {
      if (!(effect.optional === true && picks.length === 0)) steps.push({ effect, aim: null, missing: true });
      continue;
    }
    for (const aim of aims) steps.push({ effect, aim, missing: false });
  }

  // D494 - what each clause PRODUCED, for a clause about the previous one's objects: the clause's card aims, and the
  // tokens created and the permanents put onto the battlefield among the events it emitted (`start` to `end`).
  // D504 - and the players its objects belonged to AS THE CLAUSE ACTED ON THEM (`known`: the aim's controller and owner
  // before the move - CR 608.2h's last known information; a countered spell's controller), for a clause done by the
  // previous object's controller.
  const produced = new Map<number, { start: number; end: number; aims: InstanceId[]; objects?: readonly InstanceId[]; known?: { controller: PlayerId; owner: PlayerId }[] }>();
  const unbound = (e: EffectSpec): EffectSpec => { const rest: Record<string, unknown> = { ...e }; delete rest['ofPrevious']; return rest as unknown as EffectSpec; };
  const unboundPlayer = (e: EffectSpec): EffectSpec => { const rest: Record<string, unknown> = { ...e }; delete rest['ofPreviousPlayer']; return rest as unknown as EffectSpec; };
  const objectsOf = (at: number): readonly InstanceId[] => {
    const rec = produced.get(at);
    if (!rec) return [];
    if (rec.objects !== undefined) return rec.objects;
    // D495 - a token maker's objects are the tokens it made: `Create a token that's a copy of target creature ...
    // Sacrifice it at the beginning of the next end step.` is about the copy, never the creature it copied (the
    // clause's aim); the aims stand for every other clause (a target exiled, pumped, returned).
    const maker = effects[at]?.kind === 'createToken' || effects[at]?.kind === 'populate';
    const seen = new Set<InstanceId>(maker ? [] : rec.aims);
    for (const ev of out.slice(rec.start, rec.end)) {
      if (ev.t === 'TokenCreated') seen.add(ev.card);
      if (ev.t === 'CardsMoved') for (const m of ev.moves) if (m.to.kind === 'battlefield') seen.add(m.card);
      // D500 - a scoped clause's permanents: the pump, the grant, the tap and the untap name each one they reached.
      if (ev.t === 'PtModifiedUntilEndOfTurn' || ev.t === 'KeywordsGained' || ev.t === 'RegenerationShieldAdded') seen.add(ev.card);
      if (ev.t === 'PermanentsTapped' || ev.t === 'PermanentsUntapped') for (const c of ev.cards) seen.add(c);
      // D506 - a mass counter's members (D505's `massCounters` puts them in one event).
      if (ev.t === 'CountersChanged') for (const c of ev.changes) seen.add(c.card);
    }
    return [...seen];
  };
  for (let si = 0; si < steps.length; si++) {
    const step = steps[si] as (typeof steps)[number];
    const { aim, missing } = step;
    // D484 - the events this step adds; a question among them stops the loop below.
    const before = out.length;
    // D418 - `let`: a counted clause is rescaled below before its kind is switched on.
    let effect = step.effect;
    const at = step.at ?? effects.indexOf(step.effect);
    // D504 - THE PREVIOUS OBJECT'S CONTROLLER, bound now: the players the clause before acted on the objects of, as
    // they were known then (one step per distinct player, spliced in as ordinary player-aimed steps; the marker says
    // who). Nothing known - the target gone before the clause before ran - and the clause says so (D90).
    if (effect.ofPreviousPlayer !== undefined) {
      const who = effect.ofPreviousPlayer;
      // A rider that acted on nothing (`It can't be regenerated.`) between the object clause and this one is stepped over.
      let from = at - 1;
      while (from > 0 && (produced.get(from)?.known ?? []).length === 0 && effects[from]?.kind === 'noop') from--;
      const known = produced.get(from)?.known ?? [];
      produced.set(at, { start: before, end: before, aims: [], objects: [] });
      const players = [...new Set(known.map((k) => k[who]))].filter((p) => state.players[p] !== undefined && !state.players[p]?.hasLost);
      if (players.length === 0) {
        out.push(narrated(`${obj.label} — nothing for “${effect.text}” to act on.`, obj.controller, obj.identity));
        continue;
      }
      for (const p of players) out.push({ t: 'ReferentPlayerBound', player: p, text: effect.text });
      steps.splice(si + 1, 0, ...players.map((p) => ({ effect: unboundPlayer(effect), aim: { kind: 'player', id: p } as Aim, missing: false, at })));
      continue;
    }
    // D494 - THE PREVIOUS CLAUSE'S OBJECTS, bound now: an immediate clause (a grant) runs once per object, spliced in
    // as ordinary aimed steps; a delayed one is armed with the objects as its aims (below).
    if (effect.ofPrevious === true) {
      const objects = objectsOf(at - 1);
      produced.set(at, { start: before, end: before, aims: [], objects });
      if (objects.length === 0) {
        out.push(narrated(`${obj.label} — nothing for “${effect.text}” to act on.`, obj.controller, obj.identity));
        continue;
      }
      if (!effect.delay) {
        let now = state;
        for (const body of out) now = apply(now, { seq: now.eventCount, body, cause: { kind: 'system' } } as never);
        const spliced = objects
          .map((id) => aimOf(now, { kind: 'card', id }))
          .filter((a): a is Aim => a !== null)
          .map((a) => ({ effect: unbound(effect), aim: a, missing: false, at }));
        steps.splice(si + 1, 0, ...spliced);
        continue;
      }
    }
    if (at >= 0 && !produced.has(at)) produced.set(at, { start: before, end: before, aims: [] });
    const rec = at >= 0 ? produced.get(at) : undefined;
    if (rec && aim?.kind === 'card' && !rec.aims.includes(aim.id)) rec.aims.push(aim.id);
    // D504 - the object's players as this step finds them (the planned aim's controller and owner; a stack object's
    // controller), before the step moves it.
    if (rec && aim?.kind === 'card') rec.known = [...(rec.known ?? []), { controller: aim.controller, owner: aim.owner }];
    if (rec && aim?.kind === 'stack') {
      const so = state.stack.find((s) => s.id === aim.id);
      if (so) rec.known = [...(rec.known ?? []), { controller: so.controller, owner: so.controller }];
    }
    /**
     * ⚠️ **A SKIPPED CLAUSE SAYS SO.** CR 608.2b is right that the spell still
     * resolves when only SOME of its targets are gone — only an all-illegal
     * spell is countered on resolution — but for a milestone this branch was a
     * bare `continue`, and a spell that resolves having done nothing, with the
     * log reading only "Mind Rot resolves.", is indistinguishable from a bug.
     *
     * ⚠️ IT COST FOUR HOURS TO PROVE THAT, and on a card that turned out to be
     * working: D137's investigation read "cast, resolves, nothing happened" and
     * spent the whole time inside the engine, because the log offered no way to
     * tell "your target left" from "this effect is broken". The line below is
     * the difference between those two, and it is the reason it exists.
     *
     * A CARD is the subject, so no parts and no person (see the file header).
     */
    if (missing) {
      out.push(
        narrated(
          `${obj.label} — no legal target left for “${effect.text}”`,
          obj.controller,
          obj.identity,
        ),
      );
      continue;
    }

    // D403 - `If this spell was kicked, ...` on a spell that was not: the clause does nothing, and
    // the narration says so rather than saying nothing (D90's other direction is silence).
    if (effect.ifKicked && !((obj.kicked ?? 0) > 0)) {
      out.push(narrated(`${obj.label} was not kicked — “${effect.text}” does nothing.`, obj.controller, obj.identity));
      continue;
    }
    // D418 - THE COUNT EXPRESSION (CR 608.2h): `for each <noun>` / `where X is the number of <nouns>`
    // is read once, now, off the resolving board, and the clause's amount is multiplied by it. A
    // count of zero is a clause that does nothing, and the narration says so (D90's other direction
    // is silence) - the delayed and kicked clauses above are answered first because they carry the
    // same spec and would otherwise be scaled on a board the effect never resolves on.
    if (effect.per) {
      // A permanent's trigger reads the kicks its spell announced off the permanent (CR 702.33c).
      // D437 - the spell's X rides the stack object (`xValue`, announced at the cast).
      const count = countOf(state, deps, controller, effect.per, source ?? null, obj.kicked ?? (source ? state.cards[source]?.kicked : undefined) ?? 0, cache, obj.xValue ?? 0, obj.memo ?? 0);
      if (count === 0) {
        out.push(narrated(`${obj.label} counts nothing — “${effect.text}” does nothing.`, obj.controller, obj.identity));
        continue;
      }
      out.push(narrated(`${obj.label} counts ${count} for “${effect.text}”.`, obj.controller, obj.identity));
      effect = scaledBy(effect, count);
    }
    // D402 - a DELAYED effect is armed now and runs when its step begins (CR 603.7): the entry
    // carries the same spec with the delay cleared, the resolving object's id and this clause's
    // position for a replay-stable id, and the turn and step it was armed in.
    if (effect.delay) {
      // D494 - a delayed clause about the previous clause's objects is armed WITH them: the fire runs it over those
      // aims (`DelayedTrigger.aims`), the spec aimed at its first clause and no longer about a previous one.
      // D497 - a delayed clause aimed at ONE TARGET is armed with the pick it was aimed at (one entry per aim); a clause
      // about the source (`Sacrifice it at end of combat`) keeps its `self` and finds the source as it fires.
      const bound = effect.ofPrevious === true ? objectsOf(at) : !effect.self && aim?.kind === 'card' ? [aim.id] : undefined;
      const trigger: DelayedTrigger = {
        id: `${obj.id}-d${effects.indexOf(effect)}${bound !== undefined && effect.ofPrevious !== true && aim?.kind === 'card' ? `-${aim.id}` : ''}`,
        controller,
        source: source ?? null,
        when: effect.delay,
        armedTurn: state.turn.turnNumber,
        armedStep: state.turn.step,
        effects: [bound !== undefined ? { ...unbound(effect), delay: null, targetIndex: 0 } : { ...effect, delay: null }],
        label: `${obj.label} — ${effect.text}`,
        ...(bound !== undefined ? { aims: bound } : {}),
      };
      out.push({ t: 'DelayedTriggerArmed', trigger });
      out.push(narrated(`${obj.label} — “${effect.text}” will happen ${delayLabel(effect.delay)}.`, obj.controller, obj.identity));
      if (rec) rec.end = out.length;
      continue;
    }
    switch (effect.kind) {
      case 'damage': {
        if (!aim || aim.kind === 'stack' || !source) break;
        // D382 - CR 615.9. The clause rides the same effects, exactly as
        // `noRegenerate` does for the destroy above.
        const unpreventable = effects.some((e) => e.cantBePrevented === true);
        out.push(dealt([damageTo(state, deps, source, aim, effect.amount, cache, unpreventable)]));
        break;
      }

      /**
       * D382 - CR 615: put the shield up. Spending it is the funnel's job
       * (`prevention.ts`), which is what makes it apply to damage from any
       * emitter rather than only to damage this file builds.
       */
      case 'prevent': {
        const amount = effect.preventAmount;
        if (amount === undefined) break;
        // D427 - the SOURCE the sentence names: this clause's target (a card, or a player whose creatures), a
        // filter with `you` / `your opponents` resolved to players now, one target excepted.
        const ps = effect.preventSource;
        const srcAimCard = ps !== undefined && (ps.kind === 'target' || ps.exceptTarget === true);
        const srcAimPlayer = ps !== undefined && ps.kind !== 'target' && ps.controller === 'targetPlayer';
        let source: PreventionShield['source'] | undefined;
        if (ps !== undefined) {
          if (ps.kind === 'target') {
            if (aim?.kind !== 'card') break;
            source = { kind: 'card', id: aim.id };
          } else {
            if (srcAimPlayer && aim?.kind !== 'player') break;
            if (ps.exceptTarget === true && aim?.kind !== 'card') break;
            const { controller: ctl, exceptTarget: _x, ...rest } = ps;
            const controller: ShieldSourceFilter['controller'] =
              ctl === 'any' ? 'any' : ctl === 'you' ? { player: obj.controller } : ctl === 'opponents' ? { notPlayer: obj.controller } : { player: (aim as { id: PlayerId }).id };
            source = { ...rest, controller, ...(ps.exceptTarget === true && aim?.kind === 'card' ? { except: aim.id } : {}) };
          }
        }
        // The recipient: a set the sentence names (D427), the scope, or this clause's aim - the aim the
        // source did not take.
        const rp = effect.preventRecipient;
        const recipient: PreventionShield['recipient'] | null =
          effect.preventBothWays === true
            ? aim?.kind === 'card' ? ({ kind: 'card', id: aim.id } as const) : null
            : rp === 'creatures'
              ? ({ kind: 'creatures', controller: 'any' } as const)
              : rp === 'creaturesYouControl'
                ? ({ kind: 'creatures', controller: { player: obj.controller } } as const)
                : rp === 'youAndCreatures'
                  ? ({ kind: 'playerAndTheirs', player: obj.controller, what: 'creatures' } as const)
                  : rp === 'youAndPermanents'
                    ? ({ kind: 'playerAndTheirs', player: obj.controller, what: 'permanents' } as const)
                    : effect.preventScope === 'any' || srcAimCard || srcAimPlayer
                      ? ({ kind: 'any' } as const)
                      : effect.preventScope === 'players'
                        ? ({ kind: 'players' } as const)
                        : effect.preventScope === 'you'
                          ? ({ kind: 'player', id: obj.controller } as const)
                          : aim?.kind === 'card'
                            ? ({ kind: 'card', id: aim.id } as const)
                            : aim?.kind === 'player'
                              ? ({ kind: 'player', id: aim.id } as const)
                              : null;
        if (recipient === null) break;
        if (effect.preventBothWays === true && aim?.kind === 'card') source = { kind: 'card', id: aim.id };
        shieldSeq += 1;
        out.push({
          t: 'PreventionShieldsAdded',
          shields: [
            {
              id: `sh${obj.id}:${shieldSeq}`,
              amount,
              combatOnly: effect.preventCombatOnly === true,
              recipient,
              // Spread-conditional so a shield with no source is the exact pre-D427 record (hash-identical replays).
              ...(source !== undefined ? { source } : {}),
            },
          ],
        });
        break;
      }

      case 'destroy':
      case 'destroyObj': {
        if (aim?.kind !== 'card') break;
        if (effect.kind === 'destroyObj' && state.cards[aim.id]?.zone.kind !== 'battlefield') break;
        // ⚠️ Indestructible is a Tier-2 keyword the engine already knows, and
        // "destroy" is precisely the word it answers. Skipping the check would
        // make the app wrong about a keyword it advertises.
        const d = derive(state, deps.oracle, deps.scripts, aim.id, cache);
        if (d.keywords.has('indestructible')) {
          out.push(
            narrated(
              `${obj.label} cannot destroy ${d.name} — it is indestructible.`,
              obj.controller,
              obj.identity,
            ),
          );
          break;
        }
        // D330 - CR 701.19: a regeneration shield replaces the destruction -
        // tapped, damage removed, out of combat, the shield spent - unless the
        // spell says it can't be regenerated (the clause rides the same effects).
        if ((state.regenerationShields[aim.id] ?? 0) > 0 && !effects.some((e) => e.noRegenerate === true)) {
          const inst = state.cards[aim.id];
          if (inst && !inst.tapped) out.push({ t: 'PermanentsTapped', cards: [aim.id] });
          out.push({ t: 'DamageCleared', cards: [aim.id] });
          out.push({ t: 'RemovedFromCombat', cards: [aim.id] });
          out.push({ t: 'Regenerated', card: aim.id });
          out.push(narrated(`${d.name} regenerates.`, obj.controller, obj.identity));
          break;
        }
        // D469 - CR 122.1i: a shield counter replaces the destruction and is removed instead.
        if ((state.cards[aim.id]?.counters['shield'] ?? 0) > 0) {
          out.push({ t: 'CountersChanged', changes: [{ card: aim.id, kind: 'shield', delta: -1 }] });
          out.push(narrated(`A shield counter on ${d.name} is removed instead.`, obj.controller, obj.identity));
          break;
        }
        out.push(moveTo(aim.id, 'graveyard', aim.owner));
        break;
      }

      case 'exile': {
        if (aim?.kind !== 'card') break;
        // D407 - THE LINKED EXILE (CR 610.3): linked to the source ON THE BATTLEFIELD by its entry stamp;
        // a source already gone exiles nothing (610.3b), and says so.
        if (effect.untilLeaves) {
          const srcInst = source ? state.cards[source] : undefined;
          if (!source || !srcInst || srcInst.zone.kind !== 'battlefield') {
            out.push(narrated(`${obj.label} is no longer on the battlefield: nothing is exiled.`, controller, obj.identity));
            break;
          }
          out.push({
            t: 'CardsMoved',
            moves: [{ card: aim.id, from: { kind: 'battlefield', player: null }, to: { kind: 'exile', player: aim.owner }, until: { source, entry: srcInst.entries ?? 0 } }],
          });
          break;
        }
        // Exile is not destruction: indestructible does not save it (CR 701.10a).
        out.push(moveTo(aim.id, 'exile', aim.owner));
        break;
      }

      case 'bounce': {
        if (aim?.kind !== 'card') break;
        out.push(moveTo(aim.id, 'hand', aim.owner));
        break;
      }

      // D494 - THE PREVIOUS CLAUSE'S OBJECTS, acted on: the grant (until end of turn, or while the object stays), and
      // the delayed sacrifice / exile / bounce / return of what a clause created, returned or aimed at. Each runs over
      // one bound aim; an object that has left the zone the verb needs does nothing (it is a different object, or gone).
      case 'grantObj': {
        if (aim?.kind !== 'card' || effect.keywords.length === 0) break;
        if (effect.indefinite === true) out.push({ t: 'KeywordsGained', card: aim.id, keywords: effect.keywords });
        else out.push({ t: 'PtModifiedUntilEndOfTurn', card: aim.id, power: 0, toughness: 0, keywords: effect.keywords });
        break;
      }
      case 'sacrificeObj': {
        if (aim?.kind !== 'card' || state.cards[aim.id]?.zone.kind !== 'battlefield') break;
        out.push(moveTo(aim.id, 'graveyard', aim.owner, 'sacrifice'));
        break;
      }
      case 'exileObj': {
        if (aim?.kind !== 'card' || state.cards[aim.id]?.zone.kind !== 'battlefield') break;
        out.push(moveTo(aim.id, 'exile', aim.owner));
        break;
      }
      case 'bounceObj': {
        if (aim?.kind !== 'card' || state.cards[aim.id]?.zone.kind !== 'battlefield') break;
        out.push(moveTo(aim.id, 'hand', aim.owner));
        break;
      }
      case 'returnObj': {
        if (aim?.kind !== 'card') break;
        const inst = state.cards[aim.id];
        if (!inst || (inst.zone.kind !== 'exile' && inst.zone.kind !== 'graveyard')) break;
        out.push({ t: 'CardsMoved', moves: [{ card: aim.id, from: { kind: inst.zone.kind, player: inst.zone.player }, to: { kind: 'battlefield', player: inst.owner } }] });
        break;
      }

      case 'counter': {
        if (aim?.kind !== 'stack') break;
        const victim = state.stack.find((s) => s.id === aim.id);
        if (!victim) break;
        // D336 - "This spell can't be countered.": the funnel would drop the
        // counter anyway; saying so here keeps the resolver's own line honest.
        const victimCard = victim.card === null ? undefined : state.cards[victim.card];
        // D422 - a SPELL face carries the line itself (`OracleFace.cantBeCountered`); a permanent's is its script's.
        const victimFace = victimCard ? deps.oracle.byPrinting(victimCard.printingId) : undefined;
        if (victimCard && (deps.scripts.get(victimCard.oracleId)?.cantBeCountered !== undefined || (victimFace !== undefined && faceOf(victimFace, victimCard.faceIndex).cantBeCountered))) {
          out.push(narrated(`${victim.label} can't be countered.`, obj.controller, obj.identity));
          break;
        }
        out.push({ t: 'SpellCountered', stackId: victim.id });
        // A countered SPELL goes to its owner's graveyard; an ability just ceases.
        // D307 - a spell cast by flashback goes to exile instead (CR 702.34a).
        // D422 - the clause may say where instead (`If that spell is countered this way, exile it / put it into
        // its owner's hand / on top of / on the bottom of its owner's library`): the card goes there, flashback's
        // exile standing only where the clause names the graveyard it would have gone to.
        if (victim.card) {
          const vc = state.cards[victim.card];
          const to = effect.counterTo;
          if (vc && (to === 'libraryTop' || to === 'libraryBottom')) {
            out.push({ t: 'CardsMoved', moves: [{ card: victim.card, from: { kind: 'stack', player: null }, to: { kind: 'library', player: vc.owner }, placement: to === 'libraryTop' ? 'top' : 'bottom' }] });
          } else if (vc && to === 'hand') {
            out.push({ t: 'CardsMoved', moves: [{ card: victim.card, from: { kind: 'stack', player: null }, to: { kind: 'hand', player: vc.owner } }] });
          } else if (vc) {
            out.push(moveFromStack(victim.card, to === 'exile' || victim.castFrom?.kind === 'graveyard' ? 'exile' : 'graveyard', vc.owner));
          }
        }
        out.push(narrated(`${obj.label} counters ${victim.label}.`, obj.controller, obj.identity));
        break;
      }

      // D487 - THE SPELL COPY (CR 707.10): a new stack object with the copied spell's copiable values - its printing
      // and face (a copy's own where the target is itself a copy), its modes, its X and its kick - under this
      // player's control, on top of the stack (707.10a); its targets the original's, and where the clause says so
      // its controller may choose new ones (707.10c) - asked once the copy exists, the clauses after this one riding
      // the question. An ability on the stack is no spell and a face-down spell copies as nothing (708.2): the clause
      // says so (D90). The id is fresh past every copy this batch already made (`state` is the batch's snapshot).
      case 'copySpell': {
        if (aim?.kind !== 'stack') break;
        const original = state.stack.find((s) => s.id === aim.id);
        const originalCard = original === undefined || original.card === null ? undefined : state.cards[original.card];
        const of = original === undefined ? undefined : original.copyOf ?? (originalCard ? { printingId: originalCard.printingId, faceIndex: original.faceIndex } : undefined);
        if (original === undefined || original.kind !== 'spell' || original.faceDown || of === undefined) {
          out.push(narrated(`${obj.label} — nothing to copy for “${effect.text}”.`, obj.controller, obj.identity));
          break;
        }
        const colors = effect.copy?.exceptions?.colors ?? of.colors;
        const made = out.filter((e) => e.t === 'SpellCopied').length;
        const copy: StackObject = {
          id: `s${state.counters.stack + 1 + made}`,
          kind: 'spell',
          controller,
          card: null,
          source: original.card ?? original.source,
          abilityRef: null,
          targets: original.targets,
          ...(original.targetSlots !== undefined ? { targetSlots: original.targetSlots } : {}),
          modes: original.modes,
          xValue: original.xValue,
          label: `${original.label} (copy)`,
          identity: colors ?? original.identity,
          taxApplied: 0,
          isCommanderCast: false,
          castFrom: null,
          faceIndex: of.faceIndex,
          ...(original.kicked !== undefined ? { kicked: original.kicked } : {}),
          copyOf: { printingId: of.printingId, faceIndex: of.faceIndex, ...(colors !== undefined ? { colors } : {}) },
        };
        out.push({ t: 'SpellCopied', obj: copy, of: original.id });
        out.push(narrated(`${obj.label} copies ${original.label}.`, obj.controller, obj.identity));
        if (effect.newTargets === true && copy.targets.length > 0 && copy.source !== null) {
          const oracleCard = deps.oracle.byPrinting(of.printingId);
          const face = oracleCard === undefined ? undefined : faceOf(oracleCard, of.faceIndex);
          const specs = face === undefined ? [] : face.modal ? modeSpecs(face.modal.modes, copy.modes) : face.targets;
          if (specs.length > 0) {
            out.push({ t: 'AwaitingSet', awaiting: { kind: 'chooseTargets', player: controller, stackId: copy.id, count: 0, source: copy.source, label: copy.label, specs, forKind: 'copy' } });
          }
        }
        break;
      }

      case 'pump': {
        if (aim?.kind !== 'card') break;
        out.push({
          t: 'PtModifiedUntilEndOfTurn',
          card: aim.id,
          power: effect.power,
          toughness: effect.toughness,
          // D194 — the keyword rider. Spread-conditional so a plain pump
          // emits the exact pre-D194 event, hash-identical on replay.
          ...(effect.keywords.length > 0 ? { keywords: effect.keywords } : {}),
          // D399 - the printed unblockable rider, on the same entry, spread-conditional too.
          ...(effect.cantBeBlocked ? { cantBeBlocked: true as const } : {}),
        });
        break;
      }

      case 'massPump': {
        // D301 - every creature the controller controls, as the board derives
        // NOW (a Levitation-granted type counts; a face-down 2/2 is a creature).
        // One carrier entry per creature, the same shape the targeted pump emits.
        // D383 - and any other scope the closed reader names; absent means the
        // D301 one, so every spec shipped before means exactly what it meant.
        for (const id of scopeMembers(state, deps, controller, effect.scopes ?? [MASS_PUMP_SCOPE], cache).cards) {
          out.push({
            t: 'PtModifiedUntilEndOfTurn',
            card: id,
            power: effect.power,
            toughness: effect.toughness,
            ...(effect.keywords.length > 0 ? { keywords: effect.keywords } : {}),
          });
        }
        break;
      }

      /**
       * D383 - THE SCOPED BOARD EFFECTS. The set comes from ONE reader; the verbs
       * emit exactly what their targeted cousins emit, so prevention (D382),
       * protection, indestructible and every watcher see the same events they
       * always did - one BATCH, because a sweep is simultaneous.
       */
      case 'damageEach': {
        if (!source) break;
        const m = scopeMembers(state, deps, controller, effect.scopes ?? [], cache);
        const damages = [
          ...m.cards.flatMap((id) => {
            const inst = state.cards[id];
            return inst === undefined
              ? []
              : [damageTo(state, deps, source, { kind: 'card', id, controller: inst.controller, owner: inst.owner }, effect.amount, cache)];
          }),
          ...m.players.map((p) => damageTo(state, deps, source, { kind: 'player', id: p }, effect.amount, cache)),
        ];
        if (damages.length > 0) out.push(dealt(damages));
        break;
      }

      case 'destroyAll': {
        const moves = [];
        for (const id of scopeMembers(state, deps, controller, effect.scopes ?? [], cache).cards) {
          const inst = state.cards[id];
          if (!inst) continue;
          // Indestructible is a Tier-2 keyword the engine knows and "destroy" is
          // the word it answers, exactly as the targeted destroy above.
          if (derive(state, deps.oracle, deps.scripts, id, cache).keywords.has('indestructible')) continue;
          // ⚠️ D383 - AND SO IS THE REGENERATION SHIELD (CR 701.19). The first cut said "exactly
          // as the targeted destroy above" and did only HALF of what that case does: a sweep is
          // the same word, so a creature with a shield survives it - tapped, damage removed, out
          // of combat, the shield spent - unless the card says it can't be regenerated. Per
          // MEMBER, because each permanent has its own shield and none of them is shared.
          if ((state.regenerationShields[id] ?? 0) > 0 && !effects.some((e) => e.noRegenerate === true)) {
            if (!inst.tapped) out.push({ t: 'PermanentsTapped', cards: [id] });
            out.push({ t: 'DamageCleared', cards: [id] });
            out.push({ t: 'RemovedFromCombat', cards: [id] });
            out.push({ t: 'Regenerated', card: id });
            continue;
          }
          // D469 - CR 122.1i, per member: a shield counter is removed instead of the destruction.
          if ((inst.counters['shield'] ?? 0) > 0) {
            out.push({ t: 'CountersChanged', changes: [{ card: id, kind: 'shield', delta: -1 }] });
            continue;
          }
          moves.push({ card: id, from: { kind: 'battlefield' as const, player: inst.controller }, to: { kind: 'graveyard' as const, player: inst.owner } });
        }
        if (moves.length > 0) out.push({ t: 'CardsMoved', moves });
        break;
      }

      case 'bounceAll': {
        const moves = [];
        for (const id of scopeMembers(state, deps, controller, effect.scopes ?? [], cache).cards) {
          const inst = state.cards[id];
          if (!inst) continue;
          moves.push({ card: id, from: { kind: 'battlefield' as const, player: inst.controller }, to: { kind: 'hand' as const, player: inst.owner } });
        }
        if (moves.length > 0) out.push({ t: 'CardsMoved', moves });
        break;
      }

      case 'gainLifePer': {
        const per = effect.perCount;
        if (per === undefined) break;
        const gy = state.zones.graveyard[controller] ?? [];
        const n =
          per === 'creaturesYouControl'
            ? Object.values(state.cards).filter(
                (c) => c.zone.kind === 'battlefield' && c.controller === controller && derive(state, deps.oracle, deps.scripts, c.id, cache).typeLine.types.includes('Creature'),
              ).length
            : per === 'cardsInYourGraveyard'
              ? gy.length
              : gy.filter((id) => {
                  const inst = state.cards[id];
                  const oc = inst ? deps.oracle.byPrinting(inst.printingId) : undefined;
                  return oc !== undefined && inst !== undefined && faceOf(oc, inst.faceIndex).typeLine.types.includes('Creature');
                }).length;
        const gained = effect.amount * n;
        const me = state.players[controller];
        if (gained > 0 && me) out.push(lifeChanged(controller, gained));
        break;
      }

      case 'toLibraryTop': {
        if (aim?.kind !== 'card') break;
        const inst = state.cards[aim.id];
        if (!inst) break;
        out.push({
          t: 'CardsMoved',
          moves: [{ card: aim.id, from: { kind: 'battlefield', player: inst.controller }, to: { kind: 'library', player: inst.owner }, placement: 'top' }],
        });
        break;
      }

      /**
       * D369 - THE PAYMENT PROMPT. The payer is named by the printed sentence: the
       * caster, the first target's controller (a spell on the stack, or a
       * permanent), or the targeted player. Asked ONLY when they can pay - a life
       * they do not have (CR 119.4) or a mana cost the solver cannot meet from the
       * pool and the untapped sources is not a question, so the unpaid branch runs
       * here, at once. Otherwise the prompt carries both branches and a snapshot
       * of the object, because the spell has already left the stack (D136's shape).
       */
      case 'payOptional': {
        const pay = effect.pay;
        if (!pay) break;
        let payer: Payer | null = null;
        if (pay.who === 'controller') payer = controller;
        else if (pay.who === 'targetPlayer') payer = aim?.kind === 'player' ? aim.id : null;
        else if (aim?.kind === 'card') payer = aim.controller;
        else if (aim?.kind === 'stack') payer = state.stack.find((s) => s.id === aim.id)?.controller ?? null;
        if (!payer) break;
        const seat = state.players[payer];
        // D422 - a price of `{X}` is the spell's announced X (CR 601.2b's value, on the stack object), substituted
        // as the prompt is raised; an X nobody announced is 0.
        const payCost = pay.cost && pay.cost.xCount > 0 ? { ...pay.cost, generic: pay.cost.generic + pay.cost.xCount * (obj.xValue ?? 0), xCount: 0 } : pay.cost;
        const problem = buildPaymentProblem(payCost, 0, [], 0, pay.life);
        // D415 - a VERB price is payable while its candidates suffice (D369's rule: an unpayable price is
        // not a question), read off the same list the answer is checked against (D139). The public ones
        // ride the prompt; a discard's do not (a hand is hidden, D137 - the answerer reads its own).
        let verbCandidates: readonly InstanceId[] | null = null;
        let shipCandidates = false;
        if (pay.verbs) {
          const self = obj.source ?? obj.card;
          if (pay.verbs.sacrificeSelf) {
            const inst = self === null ? undefined : state.cards[self];
            verbCandidates = self !== null && inst !== undefined && inst.zone.kind === 'battlefield' ? [self] : [];
            shipCandidates = true;
          } else {
            const cand = castCostCandidates(state, (cid) => derive(state, deps.oracle, deps.scripts, cid, cache), payer, self ?? '', pay.verbs);
            const listed = Object.values(cand.fields).find((v): v is readonly InstanceId[] => Array.isArray(v)) ?? [];
            verbCandidates = cand.enough ? listed : [];
            shipCandidates = pay.verbs.discardCost === null;
          }
        }
        const can =
          !!seat &&
          seat.life >= pay.life &&
          (payCost === null || suggestPayment(solveInputFor(state, deps.oracle, deps.scripts, payer, cache), problem, OTHER_PURPOSE) !== null) &&
          (verbCandidates === null || verbCandidates.length > 0);
        if (!can) {
          out.push(narrated(`${obj.label} - the price cannot be paid.`, obj.controller, obj.identity));
          out.push(...effectResult(state, deps, obj, pay.ifNotPaid, cache).events);
          break;
        }
        if (out.some((e) => e.t === 'AwaitingSet')) break;
        out.push({
          t: 'AwaitingSet',
          awaiting: {
            kind: 'payMana',
            player: payer,
            cost: payCost,
            life: pay.life,
            label: obj.label,
            controller: obj.controller,
            source: obj.source,
            card: obj.card,
            identity: obj.identity,
            targets: obj.targets,
            ...(obj.targetSlots !== undefined ? { targetSlots: obj.targetSlots } : {}),
            ifPaid: pay.ifPaid,
            ifNotPaid: pay.ifNotPaid,
            ...(pay.verbs ? { verbs: pay.verbs } : {}),
            ...(pay.verbs && shipCandidates && verbCandidates ? { candidates: verbCandidates } : {}),
          },
        });
        break;
      }

      /**
       * D416 - THE HAND REVEAL AND CHOOSE (CR 701.15a): the target player's hand is revealed to every seat,
       * and the CONTROLLER chooses one card the noun admits - the hand prompt with an OWNER (the chooser's
       * client lists the revealed hand off `view.peek`; the host re-asks the noun of the pick). With no card
       * the noun admits, the reveal stands and nothing else happens - the log says so. The trailing life
       * loss (Thoughtseize) rides the prompt and arrives with the answer, so the ask stays last (D195).
       */
      case 'revealHandChoose': {
        const hc = effect.handChoice;
        if (!hc || aim?.kind !== 'player') break;
        const owner = aim.id;
        const hand = [...(state.zones.hand[owner] ?? [])];
        if (hand.length > 0) out.push({ t: 'CardsRevealed', cards: hand, to: [...state.seating] });
        // D418 - the narration NAMES the hand: the reveal is cleared the moment it is answered (or cannot be
        // asked), the way a library reveal is, so no hand stays visible to the table past the moment it was
        // shown - the fuzz gate's leak invariant - and the names are what the table keeps.
        const revealedNames = hand.map((id) => { const inst = state.cards[id]; const p = inst ? deps.oracle.byPrinting(inst.printingId) : undefined; return p ? faceOf(p, inst?.faceIndex ?? 0).name : 'a card'; }).join(', ');
        out.push(narrated(n`${who(state, owner)} ${vb(owner, 'reveals', 'reveal')} ${hand.length === 0 ? 'an empty hand' : `${hand.length} card${hand.length === 1 ? '' : 's'}: ${revealedNames}`}.`, owner, obj.identity));
        const legal = handChoiceCandidates(state, deps.oracle, owner, hc);
        if (legal.length === 0 || out.some((e) => e.t === 'AwaitingSet')) {
          if (legal.length === 0) {
            out.push(narrated(`${obj.label} - no ${hc.what} to choose.`, obj.controller, obj.identity));
            if (hc.loseLife > 0) { const p = state.players[controller]; if (p) out.push(lifeChanged(controller, -hc.loseLife)); }
          }
          if (hand.length > 0) out.push({ t: 'RevealCleared', cards: hand });
          break;
        }
        out.push({
          t: 'AwaitingSet',
          awaiting: {
            kind: 'chooseFromZone',
            player: controller,
            zone: 'hand',
            owner,
            rest: null,
            count: 1,
            filter: hc.filter,
            qualifier: hc.qualifier,
            none: hc.none,
            then: hc.then,
            label: obj.label,
            ...(hc.loseLife > 0 ? { loseLife: hc.loseLife } : {}),
          },
        });
        break;
      }

      /**
       * D417 - THE PLAY PERMISSION: the top N of the controller's library go to exile face up (public - no
       * reveal needed), and the controller may play each until the deadline: `state.playPermissions`, read
       * by the legal offer, the cast and the land play, dropped when the card leaves exile or the deadline
       * passes (the cleanup and end-step turn actions). A shorter library exiles what it has.
       */
      case 'exileTopPlay': {
        const ep = effect.exilePlay;
        if (!ep) break;
        const lib = state.zones.library[controller] ?? [];
        // The library is bottom-first: its last entries are the top.
        const top = lib.slice(Math.max(0, lib.length - ep.count)).reverse();
        if (top.length === 0) {
          out.push(narrated(`${obj.label} - the library is empty.`, obj.controller, obj.identity));
          break;
        }
        out.push({
          t: 'CardsMoved',
          moves: top.map((card) => ({ card, from: { kind: 'library' as const, player: controller }, to: { kind: 'exile' as const, player: state.cards[card]?.owner ?? controller } })),
        });
        for (const card of top) out.push({ t: 'PlayPermissionGranted', permission: { card, player: controller, until: ep.until, grantedTurn: state.turn.turnNumber } });
        const deadline = ep.until === 'thisTurn' ? 'this turn' : ep.until === 'yourNextTurn' ? 'until the end of their next turn' : 'until their next end step';
        out.push(narrated(n`${who(state, controller)} ${vb(controller, 'exiles', 'exile')} the top ${top.length === 1 ? 'card' : `${top.length} cards`} of the library and may play ${top.length === 1 ? 'it' : 'them'} ${deadline}.`, controller, obj.identity));
        break;
      }

      // D369 - Sacrifice this creature: the object's own source, if it is still on the battlefield.
      /**
       * D390 - THE PLAYER QUEUE (CR 101.4). "Each player sacrifices a creature of their choice":
       * the players in the scope choose in APNAP order, each seeing the choices before theirs, and
       * the sacrifices happen at once. A player with no more legal choices than the count is
       * recorded without a prompt (everything they have, or nothing); the first player with a real
       * one is asked, the rest are parked on `pendingAsks`, and the answer handler carries the queue
       * to its end - so, like every asking effect, this one is its sentence's LAST (D195).
       */
      case 'sacrifice': {
        if (!effect.sacrifice) break;
        if (out.some((e) => e.t === 'AwaitingSet')) break;
        const filter: LookFilter = { predicates: effect.sacrifice.predicates, what: effect.sacrifice.what };
        // D482 - THE PLAYER'S SACRIFICE: a `target` scope is the player the effect aimed at (`Target player sacrifices a
        // creature of their choice`); the aim gone, nothing is asked (CR 608.2b).
        const aimed = (effect.scopes ?? []).some((s) => s.kind === 'player' && s.controller === 'target');
        if (aimed) {
          const t = effect.targetIndex >= 0 ? obj.targets[effect.targetIndex] : undefined;
          if (!t || t.kind !== 'player') break;
          out.push(...queueAsks(state, deps, controller, 'sacrifice', [], effect.amount, filter, obj.label, cache, [t.id]));
          break;
        }
        out.push(...queueAsks(state, deps, controller, 'sacrifice', effect.scopes ?? [], effect.amount, filter, obj.label, cache));
        break;
      }

      // D431 - the queue's return verb: the caster chooses a permanent the noun admits; it goes to its owner's hand.
      case 'returnChoose': {
        if (!effect.returnChoose) break;
        if (out.some((e) => e.t === 'AwaitingSet')) break;
        const filter: LookFilter = { predicates: effect.returnChoose.predicates, what: effect.returnChoose.what };
        out.push(...queueAsks(state, deps, controller, 'return', effect.scopes ?? [], effect.amount, filter, obj.label, cache));
        break;
      }

      // D488 - POPULATE (CR 701.31): a token that is a copy of a creature token the controller controls, the token
      // their choice - the D390 queue's question with its own verb; forced with one candidate, nothing with none
      // (701.31a). The batch so far is FOLDED first: `Create a token, then populate` copies the token this resolution
      // just made, which D295's snapshot cannot see. The forced copy takes the executor's own next id (a later
      // clause's token must not collide); a chosen copy takes the state's counter at the answer (`askBatch`).
      // D491 - THE FROM-HAND FREE CAST: the bound resolved NOW (the spell's announced X; for the referent forms the
      // face of the spell's first target, read off the state the spell resolved against - a countered spell has
      // left the stack by this clause), the controller's hand asked through the one reader the answer handler asks;
      // nothing admitted narrates and the spell goes on, else the chooser goes up with the grant on it and the
      // ANSWER begins the cast (`handlers.ts`, `beginGrantedCast`) with the clauses after this one riding it.
      case 'castFromHand': {
        if (out.some((e) => e.t === 'AwaitingSet')) break;
        const grant = effect.castFree;
        if (grant === undefined) break;
        const wantsRef = grant.bound?.kind === 'referent' || grant.sharesType;
        const ref = wantsRef ? referentFace(state, deps, obj) : null;
        if (wantsRef && ref === null) {
          out.push(narrated(`${obj.label} — nothing to cast: the spell it names is not there to read.`, obj.controller, obj.identity));
          break;
        }
        const n = grant.bound === null ? null : grant.bound.kind === 'n' ? grant.bound.n : grant.bound.kind === 'x' ? (obj.xValue ?? 0) : ref === null ? 0 : ref.manaValue;
        const filter: LookFilter | null = grant.sharesType && ref !== null
          ? { predicates: ref.types.map((t) => ({ supertypes: [], types: [t], subtypes: [], colors: [] })), what: `a spell that shares a card type with ${ref.name}` }
          : grant.filter;
        const qualifier: SearchQualifier | null = n === null ? null : { manaValue: { op: 'lte', n }, name: null };
        let now = state;
        for (const body of out) now = apply(now, { seq: now.eventCount, body, cause: { kind: 'system' } } as never);
        if (freeCastCandidates(now, deps, controller, { none: grant.none, filter, qualifier }).length === 0) {
          out.push(narrated(`${obj.label} — nothing in hand to cast without paying its mana cost.`, obj.controller, obj.identity));
          break;
        }
        out.push({
          t: 'AwaitingSet',
          awaiting: {
            kind: 'chooseFromZone',
            player: controller,
            zone: 'hand',
            rest: null,
            count: 1,
            min: 0,
            ...(filter !== null ? { filter } : {}),
            ...(grant.none.length > 0 ? { none: grant.none } : {}),
            ...(qualifier !== null ? { qualifier } : {}),
            label: obj.label,
            castFree: true,
          },
        });
        break;
      }

      case 'populate': {
        if (out.some((e) => e.t === 'AwaitingSet')) break;
        let now = state;
        for (const body of out) now = apply(now, { seq: now.eventCount, body, cause: { kind: 'system' } } as never);
        const filter: LookFilter = { predicates: [{ supertypes: [], types: ['Creature'], subtypes: [], colors: [], token: true }], what: 'creature token you control' };
        const cands = askCandidates(now, deps, controller, 'populate', filter);
        if (cands.length === 0) {
          out.push(narrated(`${obj.label} — no creature token to populate.`, obj.controller, obj.identity));
          break;
        }
        const one = cands.length === 1 ? cands[0] : undefined;
        const copied = one === undefined ? undefined : now.cards[one];
        if (copied !== undefined) {
          nextInstance++;
          out.push({ t: 'TokenCreated', card: `c${nextInstance}`, oracleId: copied.oracleId, printingId: copied.printingId, controller, owner: controller, turnNumber: state.turn.turnNumber, faceIndex: copied.faceIndex, copyOf: copied.id, ...(copied.copyExceptions !== undefined ? { copyExceptions: copied.copyExceptions } : {}) });
          out.push({ t: 'Populated', player: controller, token: copied.id, copy: `c${nextInstance}` });
          out.push(narrated(`${obj.label} — populate: a token that is a copy of ${derive(now, deps.oracle, deps.scripts, copied.id).name}.`, obj.controller, obj.identity));
          break;
        }
        out.push(...queueAsks(now, deps, controller, 'populate', [{ kind: 'player', controller: 'you' }], 1, filter, obj.label));
        break;
      }

      // D489 - THE SUSPEND TICK (CR 702.62c/d): at the owner's upkeep a time counter comes off the exiled card; with
      // the last gone the card is CAST without paying its mana cost - the free cast from exile: the card moves to the
      // stack and a spell object goes on with nothing paid (`alternativePaid`; `suspended` for the haste the entry
      // gives a creature, 702.62e), a cast like any other for the bus and the turn's memory. A card no longer
      // suspended in exile (it left, or was cast some other way) ends the ticks; while counters remain the tick
      // re-arms itself for the next upkeep. The id is fresh past every spell this batch already put on.
      case 'suspendTick': {
        if (!source) break;
        const inst = state.cards[source];
        if (!inst || inst.zone.kind !== 'exile' || inst.suspended !== true) break;
        const oracleCard = deps.oracle.byPrinting(inst.printingId);
        const face = oracleCard === undefined ? undefined : faceOf(oracleCard, 0);
        if (oracleCard === undefined || face === undefined) break;
        const had = inst.counters['time'] ?? 0;
        if (had > 0) out.push({ t: 'CountersChanged', changes: [{ card: source, kind: 'time', delta: -1 }] });
        if (had - 1 > 0) {
          out.push({ t: 'DelayedTriggerArmed', trigger: suspendTick(state, source, inst.owner, face.name) });
          out.push(narrated(`${face.name} — a time counter is removed (${had - 1} left).`, controller, oracleCard.colorIdentity));
          break;
        }
        const made = out.filter((e) => e.t === 'SpellCast' || e.t === 'SpellCopied').length;
        const spell: StackObject = {
          id: `s${state.counters.stack + 1 + made}`,
          kind: 'spell',
          faceIndex: 0,
          controller,
          card: source,
          source: null,
          abilityRef: null,
          targets: [],
          modes: [],
          xValue: null,
          label: face.name,
          identity: oracleCard.colorIdentity,
          taxApplied: 0,
          isCommanderCast: false,
          castFrom: { kind: 'exile', player: inst.owner },
          alternativePaid: true,
          suspended: true,
        };
        out.push({ t: 'CardsMoved', moves: [{ card: source, from: { kind: 'exile', player: inst.owner }, to: { kind: 'stack', player: null } }] });
        out.push({ t: 'SpellCast', obj: spell });
        out.push(narrated(`${face.name} — the last time counter is removed: it is cast without paying its mana cost.`, controller, oracleCard.colorIdentity));
        break;
      }

      // D448 - unearth's delayed exile: the source, if it is still on the battlefield (it may have left for exile
      // already by the leave replacement - then nothing).
      case 'exileSelf': {
        if (!source) break;
        const gone = state.cards[source];
        if (!gone || gone.zone.kind !== 'battlefield') break;
        out.push(moveTo(source, 'exile', gone.owner));
        break;
      }

      // D501 - THE SPELL'S OWN FATE, for a PERMANENT source (`Shuffle ~ into its owner's library.` / `Put ~ on the bottom
      // of its owner's library.` as a permanent's own clause): the card leaves the battlefield for its owner's library,
      // the shuffle over the library it just joined (the events so far applied to a scratch state), the RNG advancing
      // through the log. A source on the stack is the resolving spell, and `resolveTop` moves it as it leaves the stack
      // (the card is still on the stack while its clauses run, CR 608.2) - nothing to do here.
      // D502 - THE EXTRA TURN (CR 500.7): one entry per turn granted, for the controller or the aimed player;
      // `beginNextTurn` takes the newest first. Said out loud, because the turn order is about to bend.
      case 'extraTurn': {
        const taker = effect.self ? controller : aim?.kind === 'player' ? aim.id : null;
        if (taker === null) break;
        const count = Math.max(1, effect.amount);
        for (let i = 0; i < count; i++) out.push({ t: 'ExtraTurnAdded', player: taker });
        out.push(narrated(n`${who(state, taker)} will take ${count === 1 ? 'an extra turn' : `${count} extra turns`} after this one.`, taker, obj.identity));
        break;
      }
      // D502 - `Skip the untap step of that turn.`: the extra turn the clause before it added (the newest of the
      // controller's) skips its untap step; with none added, the clause says so.
      case 'skipUntapThatTurn': {
        if (!out.some((e) => e.t === 'ExtraTurnAdded' && e.player === controller)) {
          out.push(narrated(`${obj.label} — no extra turn to skip the untap step of.`, obj.controller, obj.identity));
          break;
        }
        out.push({ t: 'ExtraTurnUntapSkipped', player: controller });
        break;
      }

      case 'bottomSelf':
      case 'shuffleSelf': {
        if (!source) break;
        const inst = state.cards[source];
        if (!inst || inst.zone.kind !== 'battlefield') break;
        out.push({ t: 'CardsMoved', moves: [{ card: source, from: { kind: 'battlefield', player: null }, to: { kind: 'library', player: inst.owner }, ...(effect.kind === 'bottomSelf' ? { placement: 'bottom' as const } : {}) }] });
        if (effect.kind === 'shuffleSelf') {
          let now = state;
          for (const body of out) now = apply(now, { seq: now.eventCount, body, cause: { kind: 'system' } } as never);
          const mixed = shuffle(rng ?? state.rng, now.zones.library[inst.owner] ?? []);
          rng = mixed.next;
          out.push({ t: 'LibraryShuffled', player: inst.owner, order: mixed.value });
        }
        break;
      }

      case 'sacrificeSelf': {
        if (!source) break;
        const inst = state.cards[source];
        if (!inst || inst.zone.kind !== 'battlefield') break;
        // D377 - the one sacrifice the VOCABULARY performs, so it carries the reason like the
        // cost machinery's does: a watcher must not care which path sacrificed the permanent.
        out.push(moveTo(source, 'graveyard', inst.owner, 'sacrifice'));
        break;
      }

      case 'tap': {
        if (aim?.kind !== 'card') break;
        if (state.cards[aim.id]?.tapped) break;
        out.push({ t: 'PermanentsTapped', cards: [aim.id] });
        break;
      }

      // D411 - the untap skip: on the aim, or on the source for the self form (a source that has left
      // the battlefield owes nothing).
      // D412 - connive (CR 701.50). The subject is the SOURCE when `self` (a source that has left the
      // battlefield still draws and discards - no counter) or the aim; the chain runs against the state
      // the clauses before it left, and stops behind its own question.
      // D413 - the exile-instead-of-dying mark (CR 614.1): on the aim, on what this resolution damaged, or
      // on the board's creatures; a mark rides the until-end-of-turn entry the pumps ride, cleared at cleanup.
      case 'exileIfDies': {
        const marked: InstanceId[] = [];
        if (effect.exileScope === 'target') {
          if (aim?.kind === 'card') marked.push(aim.id);
        } else if (effect.exileScope === 'damaged') {
          for (const e of out) if (e.t === 'DamageDealt') for (const d of e.damages) if (d.target.kind === 'card' && !marked.includes(d.target.id)) marked.push(d.target.id);
        } else {
          for (const id of state.zones.battlefield) {
            const c = state.cards[id];
            if (!c || (effect.exileScope === 'opponents' && c.controller === controller)) continue;
            if (derive(state, deps.oracle, deps.scripts, id, cache).typeLine.types.includes('Creature')) marked.push(id);
          }
        }
        for (const id of marked) {
          if (state.cards[id]?.zone.kind !== 'battlefield') continue;
          out.push({ t: 'PtModifiedUntilEndOfTurn', card: id, power: 0, toughness: 0, exileIfDies: true });
        }
        break;
      }
      case 'connive': {
        const permanent = effect.self ? (source ?? null) : aim?.kind === 'card' ? aim.id : null;
        if (permanent === null || out.some((e) => e.t === 'AwaitingSet')) break;
        let scratch = state;
        for (const body of out) scratch = apply(scratch, { seq: scratch.eventCount, body, cause: { kind: 'system' } } as never);
        out.push(...conniveChain(scratch, deps, controller, permanent, obj.label, Math.max(1, effect.amount)));
        break;
      }
      case 'freeze': {
        const frozen = effect.self ? (source ?? null) : aim?.kind === 'card' ? aim.id : null;
        if (frozen === null || state.cards[frozen]?.zone.kind !== 'battlefield') break;
        out.push({ t: 'UntapSkipSet', card: frozen, skip: true });
        break;
      }
      case 'untap': {
        if (aim?.kind !== 'card') break;
        if (!state.cards[aim.id]?.tapped) break;
        out.push({ t: 'PermanentsUntapped', cards: [aim.id] });
        break;
      }

      // D394 - "can't block this turn" (CR 509.1b with an END): an until-end-of-turn entry that
      // `canBlock` reads and cleanup clears, riding the same event as the pumps and the grants.
      // D399 - "can't be blocked this turn": the same shape on the ATTACKER's side of the block.
      case 'cantBeBlocked': {
        if (aim?.kind !== 'card') break;
        if (state.cards[aim.id]?.zone.kind !== 'battlefield') break;
        out.push({ t: 'PtModifiedUntilEndOfTurn', card: aim.id, power: 0, toughness: 0, cantBeBlocked: true });
        break;
      }

      case 'cantBlock': {
        if (aim?.kind !== 'card') break;
        if (state.cards[aim.id]?.zone.kind !== 'battlefield') break;
        out.push({ t: 'PtModifiedUntilEndOfTurn', card: aim.id, power: 0, toughness: 0, cantBlock: true });
        break;
      }

      // D396 - BITE and FIGHT (CR 701.12): the subject (this step's aim - a target, the self, or the
      // referent) deals damage equal to its power to the clause's OTHER target; a fight deals both
      // ways at once, in ONE `DamageDealt`. Either operand gone from the battlefield, or not a
      // creature at resolution, means no damage at all (CR 701.12b/c) - and the step says so.
      case 'bite':
      case 'fight': {
        if (aim?.kind !== 'card' || effect.otherTargetIndex === undefined) break;
        const otherAim = picksFor(obj, effect.otherTargetIndex)
          .map((c) => aimOf(state, c))
          .find((a): a is Aim => a !== null && a.kind === 'card');
        if (!otherAim || otherAim.kind !== 'card') break;
        const a = state.cards[aim.id];
        const b = state.cards[otherAim.id];
        if (!a || !b || a.zone.kind !== 'battlefield' || b.zone.kind !== 'battlefield' || a.id === b.id) break;
        const da = derive(state, deps.oracle, deps.scripts, aim.id, cache);
        const db = derive(state, deps.oracle, deps.scripts, otherAim.id, cache);
        if (!da.isCreature || !db.isCreature) {
          out.push(narrated(`${obj.label}: ${da.name} and ${db.name} are not both creatures, so no damage is dealt.`, obj.controller));
          break;
        }
        const damages: ResolvedDamage[] = [];
        if ((da.power ?? 0) > 0) damages.push(damageTo(state, deps, aim.id, otherAim, da.power ?? 0, cache));
        if (effect.kind === 'fight' && (db.power ?? 0) > 0) damages.push(damageTo(state, deps, otherAim.id, aim, db.power ?? 0, cache));
        out.push({ t: 'Fought', subject: aim.id, other: otherAim.id, mutual: effect.kind === 'fight' });
        if (damages.length > 0) out.push(dealt(damages));
        out.push(narrated(effect.kind === 'fight' ? `${da.name} fights ${db.name}.` : `${da.name} deals ${da.power ?? 0} damage to ${db.name}.`, obj.controller));
        break;
      }

      // D395 - the ANIMATE family (CR 613.4b): a base P/T at layer 7b, Creature (and Artifact when
      // the text says so) with its subtypes at layer 4, colours at layer 5 and keywords at layer 6,
      // all on the one until-end-of-turn entry the pumps ride; cleanup ends it with them.
      case 'animate': {
        if (aim?.kind !== 'card' || !effect.animate) break;
        if (state.cards[aim.id]?.zone.kind !== 'battlefield') break;
        const a = effect.animate;
        out.push({
          t: 'PtModifiedUntilEndOfTurn',
          card: aim.id,
          power: 0,
          toughness: 0,
          ...(a.keywords.length > 0 ? { keywords: a.keywords } : {}),
          types: ['Creature', ...(a.artifact ? ['Artifact'] : [])],
          ...(a.subtypes.length > 0 ? { subtypes: a.subtypes } : {}),
          basePt: { power: a.power, toughness: a.toughness },
          ...(a.colors.length > 0 ? { colors: a.colors } : {}),
        });
        break;
      }

      // D393 - THREATEN (CR 514.2): the permanent is the controller's until cleanup hands it
      // back. Taking what is already yours changes nothing and remembers nothing.
      case 'control': {
        if (aim?.kind !== 'card') break;
        const taken = state.cards[aim.id];
        if (!taken || taken.zone.kind !== 'battlefield' || taken.controller === obj.controller) break;
        const d = derive(state, deps.oracle, deps.scripts, aim.id, cache);
        out.push({ t: 'ControlChangedUntilEndOfTurn', card: aim.id, controller: obj.controller, revertTo: taken.controller });
        out.push(narrated(`${obj.label}: ${d.name} changes control until end of turn.`, obj.controller));
        break;
      }

      case 'regenerate': {
        if (aim?.kind !== 'card') break;
        // D373 - CR 701.19: a shield on the permanent, spent by the next destruction this
        // turn (`destroy` above and `sba.ts` both read it; cleanup clears it with the
        // other until-end-of-turn effects). Only a permanent on the battlefield carries one.
        if (state.cards[aim.id]?.zone.kind !== 'battlefield') break;
        out.push({ t: 'RegenerationShieldAdded', card: aim.id });
        break;
      }

      case 'draw': {
        // D433 - a draw aimed at a player (`target player draws`), or over a player scope (`each player draws`, in
        // APNAP order); the caster's own otherwise.
        if (effect.scopes && effect.scopes.length > 0) {
          for (const p of apnapPlayers(state, scopeMembers(state, deps, controller, effect.scopes, cache).players)) out.push(...drawEvents(afterLibraryMoves(state, out), p, effect.amount));
          break;
        }
        if (!effect.self && aim?.kind === 'player') {
          out.push(...drawEvents(afterLibraryMoves(state, out), aim.id, effect.amount));
          break;
        }
        out.push(...drawEvents(afterLibraryMoves(state, out), controller, effect.amount));
        break;
      }

      case 'mill': {
        // D434 - the top N of a library into its graveyard (CR 701.13): the aimed player's, every member of a player
        // scope in APNAP order, or the caster's own. A short library mills what it has; nothing is lost or asked.
        if (effect.scopes && effect.scopes.length > 0) {
          for (const p of apnapPlayers(state, scopeMembers(state, deps, controller, effect.scopes, cache).players)) out.push(...millEvents(afterLibraryMoves(state, out), p, effect.amount));
          break;
        }
        if (!effect.self && aim?.kind === 'player') {
          out.push(...millEvents(afterLibraryMoves(state, out), aim.id, effect.amount));
          break;
        }
        out.push(...millEvents(afterLibraryMoves(state, out), controller, effect.amount));
        break;
      }

      case 'gainLife': {
        // D504 - the aimed player's life (the previous object's controller); the caster's otherwise.
        const gainer = !effect.self && aim?.kind === 'player' ? aim.id : controller;
        const p = state.players[gainer];
        if (!p) break;
        out.push(lifeChanged(gainer, effect.amount));
        break;
      }

      case 'loseLife': {
        // D439 - the scoped loss: every member of the player scope in APNAP order (D434's mill shape), and the
        // drain rider hands the caster the sum (`lifeChanged` keeps the batch's ledger, so a caster inside the
        // scope loses and gains on one running total).
        if (effect.scopes && effect.scopes.length > 0) {
          let lost = 0;
          for (const p of apnapPlayers(state, scopeMembers(state, deps, controller, effect.scopes, cache).players)) {
            out.push(lifeChanged(p, -effect.amount));
            lost += effect.amount;
          }
          if (effect.gainLost && lost > 0) out.push(lifeChanged(controller, lost));
          break;
        }
        // D295: `self` is the controller ("You lose 3 life."); otherwise the aimed player.
        const who = effect.self ? controller : aim?.kind === 'player' ? aim.id : null;
        if (!who) break;
        const p = state.players[who];
        if (!p) break;
        out.push(lifeChanged(who, -effect.amount));
        break;
      }

      /**
       * D295 - the TARGET'S CONTROLLER. The aim is a permanent or a spell on
       * the stack; `state` is the snapshot BEFORE this batch applies, so the
       * permanent the previous sentence destroyed still answers for its
       * controller (CR 608.2h - last known information).
       */
      case 'controllerLosesLife':
      case 'controllerDraws': {
        // "Its" is the spell's FIRST target (the sentence before named it); the
        // sentence itself consumes no target slot, so `aim` is null here.
        const first = aimOf(state, picksFor(obj, 0)[0]);
        const who =
          first?.kind === 'card'
            ? state.cards[first.id]?.controller
            : first?.kind === 'stack'
              ? state.stack.find((s) => s.id === first.id)?.controller
              : undefined;
        if (!who) break;
        if (effect.kind === 'controllerDraws') {
          out.push(...drawEvents(afterLibraryMoves(state, out), who, effect.amount));
          break;
        }
        const p = state.players[who];
        if (!p) break;
        out.push(lifeChanged(who, -effect.amount));
        break;
      }

      case 'noop':
        // D295 - the D192 vacuity sentence (named in `effectParse`): a restriction
        // on a mechanism this engine does not have, so nothing happens - by design.
        break;

      /**
       * CR 701.8a — and THE PLAYER CHOOSES, which is why this case can produce
       * a prompt where every other one produces only events. See D137.
       *
       * ⚠️ **THREE OUTCOMES, and only the third asks anything.** An empty hand
       * discards nothing; a hand no bigger than the effect goes to the graveyard
       * whole, because there is no choice left to make and a prompt with one
       * legal answer is a click that teaches the player nothing; anything larger
       * raises `chooseFromZone`.
       *
       * ⚠️ **THE PROMPT IS EMITTED, NOT THE DISCARD.** The cards move when the
       * answer comes back — so a resolution that ends here leaves the spell
       * fully resolved (it is already in the graveyard, `resolveTop` put it
       * there in this same batch) with the discard outstanding. That is D136's
       * shape exactly: the engine cannot suspend a fold, so the question comes
       * last and its consequence arrives with the answer.
       *
       * ⚠️ **ONE PROMPT PER RESOLUTION.** A second `AwaitingSet` in the same
       * batch would silently overwrite the first, so a spell with two discard
       * clauses would ask about one and drop the other — half-execution. The
       * guard is here so that stays true rather than being true by luck; since
       * D484 the executor also STOPS behind the first question and carries the
       * clauses after it on the prompt, so the second discard is asked when the
       * first is answered (the continuation), never dropped.
       */
      /**
       * CR 400.7. The card goes to its OWNER — `aim.owner`, never the caster.
       *
       * ⚠️ **A GRAVEYARD IS PUBLIC AND SHARED, so "your graveyard" is a
       * targeting restriction and not an ownership one.** By the time the spell
       * resolves the target is just a card id; `targetAllowed` is what kept it
       * to the caster's own graveyard (D138), and re-deciding it here from the
       * caster would send a stolen card to the wrong hand.
       */
      // D436 - the graveyard-card target: out of whichever graveyard the aim sits in (the target layer admitted it),
      // into exile or under its owner's library. Not `moveTo` - that helper hardcodes `from: battlefield`.
      case 'exileFromGraveyard': {
        if (aim?.kind !== 'card' || state.cards[aim.id]?.zone.kind !== 'graveyard') break;
        out.push({ t: 'CardsMoved', moves: [{ card: aim.id, from: { kind: 'graveyard', player: aim.owner }, to: { kind: 'exile', player: aim.owner } }] });
        break;
      }
      case 'graveyardToLibraryBottom': {
        if (aim?.kind !== 'card' || state.cards[aim.id]?.zone.kind !== 'graveyard') break;
        // The bottom of a library is the FRONT of the array (`drawFromTop` takes from the end): `placement` says so.
        out.push({ t: 'CardsMoved', moves: [{ card: aim.id, from: { kind: 'graveyard', player: aim.owner }, to: { kind: 'library', player: aim.owner }, placement: 'bottom' }] });
        break;
      }
      case 'returnFromGraveyard': {
        // D437 - an aim that left its graveyard is an illegal target the clause leaves alone (CR 608.2b).
        if (aim?.kind !== 'card' || state.cards[aim.id]?.zone.kind !== 'graveyard') break;
        // ⚠️ NOT `moveTo` — that helper hardcodes `from: battlefield`, which is
        // right for its four callers (destroy, exile, bounce) and wrong here.
        // A `from` that does not match where the card actually is leaves it in
        // BOTH zones, and `assertInvariants` catches it as exactly that.
        out.push({
          t: 'CardsMoved',
          moves: [
            {
              card: aim.id,
              from: { kind: 'graveyard', player: aim.owner },
              to: { kind: 'hand', player: aim.owner },
            },
          ],
        });
        break;
      }

      /**
       * ⚠️ The controller is the CASTER (CR 400.7a — "under your control" is the
       * default for a reanimation spell), and the destination is a battlefield
       * `ZoneRef` naming them. That is also what makes the entry funnel work on
       * it: `withEntersTapped` reads `move.to.player` to decide whose board the
       * permanent is arriving on, so a move that named the owner instead would
       * ask "do YOU control two other lands" of the wrong seat (D135).
       */
      case 'reanimate': {
        if (aim?.kind !== 'card' || state.cards[aim.id]?.zone.kind !== 'graveyard') break;
        out.push({
          t: 'CardsMoved',
          moves: [
            {
              card: aim.id,
              from: { kind: 'graveyard', player: aim.owner },
              to: { kind: 'battlefield', player: controller },
            },
          ],
        });
        break;
      }

      /**
       * CR 701.16 — look at the top N, keep some, the rest go somewhere. D141.
       *
       * ⚠️ **THE REVEAL IS WHAT MAKES THE PROMPT ANSWERABLE.** `CardsRevealed`
       * marks the cards `revealedTo` the controller, which is precisely what
       * `project.ts` turns into `view.peek` (D114) — the one exception to "a
       * library is a count, full stop". So the client can list the candidates
       * from its own view and the prompt ships no ids, exactly as the discard
       * prompt does for a hand. `redactEvent` strips the ids for everyone else.
       *
       * ⚠️ **FEWER CARDS THAN THE SPELL LOOKS AT IS NORMAL**, not an error — a
       * library near the bottom simply has fewer. The take is clamped, and if
       * the whole remaining library fits in the hand there is no choice to make
       * and no prompt: the same "a question with one legal answer" rule the
       * discard case follows.
       */
      case 'lookAtTop': {
        const look = effect.look;
        if (!look) break;
        const library = afterLibraryMoves(state, out).zones.library[controller] ?? [];
        if (library.length === 0) break;
        // The TOP of a library is the END of the array (`drawFromTop`).
        const top = library.slice(Math.max(0, library.length - effect.amount));
        // D493 - `Reveal the top N cards` is the same look made public: every seat sees the run.
        out.push({ t: 'CardsRevealed', cards: top, to: look.reveal === true ? [...state.seating] : [controller] });
        const take = Math.min(look.take, top.length);
        // D493 - what the noun admits among the revealed run (the negations and the filter, as the answer handler
        // reads them): a MANDATORY filtered pick can take at most that many, and none when nothing is admitted.
        const admits = (id: InstanceId): boolean => {
          const inst = state.cards[id];
          const printing = inst ? deps.oracle.byPrinting(inst.printingId) : undefined;
          if (!printing) return false;
          const face = faceOf(printing, 0);
          if ((look.none ?? []).some((t) => face.typeLine.types.includes(t))) return false;
          return look.filter === null || predicateAdmits(face, look.filter.predicates);
        };
        const admitted = look.filter !== null || (look.none ?? []).length > 0 ? top.filter(admits) : top;
        /**
         * ⚠️ **TAKE NOTHING IS A REAL FORM** (`Index`, D142): look at five and
         * put them back in an order of your choosing. It skips the pick prompt
         * entirely and goes straight to the ordering one — and a single card has
         * a single sequence, so it skips that too.
         */
        if (take === 0) {
          if (top.length > 1) {
            out.push({
              t: 'AwaitingSet',
              awaiting: {
                kind: 'orderCards',
                player: controller,
                zone: 'library',
                destination: look.rest === 'topOrdered' ? 'top' : 'bottom',
                count: top.length,
                label: obj.label,
              },
            });
          } else {
            out.push({ t: 'CardsRevealed', cards: top, to: [] });
          }
          break;
        }
        // D389 - a look with a FILTER or an OPTIONAL pick always asks: the top may hold nothing
        // the filter admits, and "you may" is the player's to decline. Only the plain form takes
        // a library too short to choose from whole (CR 701.8a's one-legal-answer rule, D141).
        if (take >= top.length && !look.filter && !look.optional && (look.none ?? []).length === 0) {
          out.push({
            t: 'CardsMoved',
            moves: top.map((card) => ({
              card,
              from: { kind: 'library' as const, player: controller },
              to: { kind: 'hand' as const, player: controller },
            })),
          });
          break;
        }
        // D493 - THE ONE-CARD LOOK WITH NOTHING TO ASK: `Look at the top card. If it's a land card, put it onto the
        // battlefield. Otherwise, put it into your hand.` - a mandatory pick over one card is no question (D141's
        // one-legal-answer rule): the card goes where the line sends it, admitted or not.
        if (top.length === 1 && !look.optional && (look.filter !== null || (look.none ?? []).length > 0)) {
          const one = top[0] as InstanceId;
          const owner = state.cards[one]?.owner ?? controller;
          const where = admitted.length === 1 ? (look.to === 'battlefield' ? 'battlefield' : 'hand') : look.rest === 'hand' ? 'hand' : look.rest === 'graveyard' ? 'graveyard' : look.rest === 'bottom' ? 'bottom' : 'top';
          if (where === 'top') {
            out.push({ t: 'CardsRevealed', cards: top, to: [] });
            out.push(narrated(`${obj.label} — the top card stays.`, obj.controller, obj.identity));
            break;
          }
          out.push({
            t: 'CardsMoved',
            moves: [where === 'bottom'
              ? { card: one, from: { kind: 'library' as const, player: controller }, to: { kind: 'library' as const, player: controller }, placement: 'bottom' as const }
              : { card: one, from: { kind: 'library' as const, player: controller }, to: where === 'battlefield' ? { kind: 'battlefield' as const, player: controller } : where === 'graveyard' ? { kind: 'graveyard' as const, player: owner } : { kind: 'hand' as const, player: controller } }],
          });
          if (where === 'battlefield' && look.tapped === true) out.push({ t: 'PermanentsTapped', cards: [one] });
          out.push({ t: 'CardsRevealed', cards: top, to: [] });
          break;
        }
        if (out.some((e) => e.t === 'AwaitingSet')) break;
        out.push({
          t: 'AwaitingSet',
          awaiting: {
            kind: 'chooseFromZone',
            player: controller,
            zone: 'library',
            rest: look.rest,
            count: take,
            // D389 - the fewest the answer may name, and the bound on what it names. Both are
            // PRINTED on the card, so both ride the prompt; the revealed run does not (D141).
            // D493 - a mandatory filtered pick takes as many as the run admits, at most `take`.
            min: look.optional ? 0 : Math.min(take, admitted.length),
            filter: look.filter,
            ...((look.none ?? []).length > 0 ? { none: look.none } : {}),
            ...(look.to === 'battlefield' ? { to: 'battlefield' as const } : {}),
            ...(look.tapped === true ? { tapped: true as const } : {}),
            label: obj.label,
          },
        });
        break;
      }

      case 'search': {
        const spec = effect.search;
        if (!spec) break;
        // D507 - the aimed player's library (the previous object's controller - Path to Exile's referent search); the
        // caster's otherwise. The answer path keys on `awaiting.player`, so the bound player answers and finds.
        const searcher = !effect.self && aim?.kind === 'player' ? aim.id : controller;
        const lib = state.zones.library[searcher] ?? [];
        // An empty library asks nothing - there is no choice to make (D137's rule). D483 - unless the graveyard is searched too.
        if (lib.length === 0 && !(spec.graveyardToo === true && (state.zones.graveyard[searcher] ?? []).length > 0)) break;
        if (out.some((e) => e.t === 'AwaitingSet')) break;
        // ⚠️ D359 - THE REVEAL WAITS FOR THE OFFER. `You may search your library` is asked
        // before anything is shown, because a player who looked and then declined would keep
        // what they saw AND skip the shuffle that was meant to bury it. The offer prompt shows
        // nothing; accepting it reveals the library and raises the same prompt again with
        // `optional` false. A search that is not optional still reveals here, in one step.
        //
        // ⚠️ The reveal is what lets the searcher see the candidates at all: their contents
        // are already in `cards` for anyone they are revealed to, and the projection turns
        // that into a SORTED list. The order never leaves the host.
        if (!spec.optional) out.push({ t: 'CardsRevealed', cards: lib, to: [searcher] });
        out.push({
          t: 'AwaitingSet',
          awaiting: {
            kind: 'searchLibrary',
            player: searcher,
            count: spec.count,
            what: spec.label,
            predicates: spec.predicates,
            destination: spec.destination,
            tapped: spec.tapped,
            shuffle: spec.shuffle,
            label: obj.label,
            optional: spec.optional,
            qualifier: spec.qualifier,
            ...(spec.graveyardToo === true ? { graveyardToo: true } : {}),
          },
        });
        break;
      }

      case 'discard': {
        // D435 - `Draw N cards. If you do, discard M cards.`: the draw first; an empty library draws nothing, so
        // nothing is discarded. The discard reads the hand AS DRAWN INTO (the drawn card may be the one discarded):
        // a hand no bigger than the count goes whole; otherwise the prompt, answered against the post-draw hand.
        if (effect.ifDrew !== undefined && effect.ifDrew > 0) {
          if (out.some((e) => e.t === 'AwaitingSet')) break;
          const lib = afterLibraryMoves(state, out);
          const before = (lib.zones.library[controller] ?? []).length;
          const drawn = drawEvents(lib, controller, effect.ifDrew);
          out.push(...drawn);
          if (before === 0) break;
          const held = [...(state.zones.hand[controller] ?? [])];
          for (const ev of drawn) if (ev.t === 'CardsMoved') for (const m of ev.moves) if (m.to.kind === 'hand') held.push(m.card);
          if (held.length <= effect.amount) {
            out.push({
              t: 'CardsMoved',
              moves: held.map((card) => ({
                card,
                from: { kind: 'hand' as const, player: controller },
                to: { kind: 'graveyard' as const, player: state.cards[card]?.owner ?? controller },
                reason: 'discard' as const,
              })),
            });
            break;
          }
          out.push({ t: 'AwaitingSet', awaiting: { kind: 'chooseFromZone', player: controller, zone: 'hand', rest: null, count: effect.amount, label: obj.label } });
          break;
        }
        // D435 - `Discard N cards. If you do, draw M cards.`: an empty hand discards nothing and draws nothing; a
        // hand no bigger than the count goes whole and draws at once; otherwise the draw RIDES the prompt.
        if (effect.thenDraw > 0 && effect.self) {
          if (out.some((e) => e.t === 'AwaitingSet')) break;
          const held = state.zones.hand[controller] ?? [];
          if (held.length === 0) break;
          if (held.length <= effect.amount) {
            out.push({
              t: 'CardsMoved',
              moves: held.map((card) => ({
                card,
                from: { kind: 'hand' as const, player: controller },
                to: { kind: 'graveyard' as const, player: state.cards[card]?.owner ?? controller },
                reason: 'discard' as const,
              })),
            });
            out.push(...drawEvents(afterLibraryMoves(state, out), controller, effect.thenDraw));
            break;
          }
          out.push({ t: 'AwaitingSet', awaiting: { kind: 'chooseFromZone', player: controller, zone: 'hand', rest: null, count: effect.amount, label: obj.label, thenDraw: effect.thenDraw } });
          break;
        }
        // D390 - "each opponent discards a card": the player queue over the hand (see `sacrifice`).
        if (effect.scopes !== undefined && effect.scopes.length > 0) {
          if (out.some((e) => e.t === 'AwaitingSet')) break;
          out.push(...queueAsks(state, deps, controller, 'discard', effect.scopes, effect.amount, null, obj.label, cache));
          break;
        }
        if (aim?.kind !== 'player') break;
        const hand = state.zones.hand[aim.id] ?? [];
        if (hand.length === 0) break;
        if (hand.length <= effect.amount) {
          out.push({
            t: 'CardsMoved',
            moves: hand.map((card) => ({
              card,
              from: { kind: 'hand' as const, player: aim.id },
              to: { kind: 'graveyard' as const, player: state.cards[card]?.owner ?? aim.id },
              reason: 'discard' as const,
            })),
          });
          break;
        }
        // ⚠️ AT RANDOM ASKS NOBODY (CR 701.8b). The cards are taken here, from
        // the SEEDED generator threaded through the log — the only source of
        // randomness this engine has, and the reason D137 refused this wording
        // rather than approximating it.
        if (effect.atRandom) {
          const draw = shuffle(rng ?? state.rng, hand);
          rng = draw.next;
          const taken = draw.value.slice(0, effect.amount);
          out.push({
            t: 'CardsMoved',
            moves: taken.map((card) => ({
              card,
              from: { kind: 'hand' as const, player: aim.id },
              to: { kind: 'graveyard' as const, player: state.cards[card]?.owner ?? aim.id },
              reason: 'discard' as const,
            })),
          });
          break;
        }
        if (out.some((e) => e.t === 'AwaitingSet')) break;
        out.push({
          t: 'AwaitingSet',
          awaiting: {
            kind: 'chooseFromZone',
            player: aim.id,
            zone: 'hand',
            // A discard leaves the unchosen where they are, so there is no
            // destination for "the rest" to go to.
            rest: null,
            count: effect.amount,
            label: obj.label,
          },
        });
        break;
      }

      /**
       * CR 701.18 / 701.42 — scry and surveil (D195). The reveal is what makes
       * the prompt answerable, exactly as `lookAtTop`'s comment says: the cards
       * become `revealedTo` the controller, `view.peek` lists them, and the
       * prompt ships no ids. ⚠️ Unlike a look, scry 1 STILL asks — top or
       * bottom is a real choice at any count — and an empty library scries
       * nothing (CR 701.18b's degenerate case).
       *
       * ⚠️ A `thenDraw` rider is NOT emitted here: the draw must see the
       * library AS REORDERED, so it rides the awaiting and the ANSWER handler
       * emits it against the post-choice state.
       */
      case 'scry':
      case 'surveil': {
        const library = afterLibraryMoves(state, out).zones.library[controller] ?? [];
        const n = Math.min(effect.amount, library.length);
        if (n === 0) break;
        const top = library.slice(library.length - n);
        out.push({ t: 'CardsRevealed', cards: top, to: [controller] });
        if (out.some((e) => e.t === 'AwaitingSet')) break;
        out.push({
          t: 'AwaitingSet',
          awaiting: {
            kind: 'scryChoice',
            player: controller,
            count: n,
            toGraveyard: effect.kind === 'surveil',
            thenDraw: effect.thenDraw,
            label: obj.label,
          },
        });
        break;
      }

      /**
       * D391 - proliferate (CR 701.27a). The prompt ships no ids (counters are public; the client
       * lists what carries one) and the answer handler validates every pick against the board as
       * it stands, then puts one more counter of each kind present. Raised only when SOMETHING
       * carries a counter once the sentences before it have landed - "Put a +1/+1 counter on
       * target creature, then proliferate" must offer that creature - so the candidates are read
       * off a scratch state the events so far are folded onto, the way the scry's rider is
       * (D195). Nothing to choose is no prompt (D137's rule).
       */
      /**
       * D409 - explore (CR 701.42). The subject is the SOURCE when `self` (a source that has left the
       * battlefield still explores - no counter, the rest happens, 701.42b) or the aim; the chain runs
       * against the state the clauses before it left, and stops behind its own question.
       */
      case 'explore': {
        const permanent = effect.self ? (source ?? null) : aim?.kind === 'card' ? aim.id : null;
        if (permanent === null || out.some((e) => e.t === 'AwaitingSet')) break;
        let scratch = state;
        for (const body of out) scratch = apply(scratch, { seq: scratch.eventCount, body, cause: { kind: 'system' } } as never);
        out.push(...exploreChain(scratch, deps, controller, permanent, obj.label, Math.max(1, effect.amount)));
        break;
      }
      case 'proliferate': {
        if (out.some((e) => e.t === 'AwaitingSet')) break;
        let scratch = state;
        for (const body of out) {
          scratch = apply(scratch, { seq: scratch.eventCount, body, cause: { kind: 'system' } } as never);
        }
        if (!proliferateCandidates(scratch).any) break;
        out.push({ t: 'AwaitingSet', awaiting: { kind: 'proliferateChoice', player: controller, label: obj.label } });
        break;
      }

      /**
       * ⚠️ THE EVENT HAS EXISTED SINCE D107 and was reached only by the Tier-3
       * counter tool and by the two built-in replacements. Nothing had to be
       * added to the log, the reducer or the hash — the whole of this primitive
       * is a vocabulary that can SAY it. See D130.
       *
       * ⚠️ Battlefield only. A counter on a card in a graveyard is a number
       * nothing reads, and `clearBattlefieldFields` wipes it on the next move
       * anyway — so emitting one would be a log line that says something
       * happened when nothing did. Targeting already restricts a `target
       * creature` to the battlefield (D91); this is the second lock, on the side
       * that writes rather than the side that aims.
       *
       * ⚠️ LETHALITY IS STILL THE SBA'S JOB, exactly as it is for damage (D90).
       * `Scar` puts a `-1/-1` counter on a 1/1 and emits nothing else; layer 7d
       * makes it 0/0 and `checkStateBasedActions` bins it on the next pass. A
       * second "is this lethal" here would eventually disagree with combat.
       */
      /**
       * ⚠️ THE PRINTING IS ON THE SPEC, resolved at build time (D133). Nothing
       * is looked up here, and that is deliberate: a token whose description
       * the table could not name never reached `effectMode: 'auto'`, so this
       * case cannot be asked to create something it has no card for.
       *
       * ⚠️ Instance ids are allocated from ONE counter across every effect this
       * object produces. Two token clauses in one spell each starting from
       * `state.counters.instance + 1` would name the same card twice, and the
       * reducer would overwrite the first with the second — one token, silently.
       */
      case 'createToken': {
        // D485 - CR 707: a token that is a COPY takes the copied object's copiable values - its printing, its face and
        // the copy exceptions it already carries (707.3) - with this clause's own exceptions on top (707.9b); counters,
        // damage and every other status stay behind. The source (`this creature`, `this card`) is copied wherever its
        // card is; a face-down object copies as nothing (708.2) and the clause says so (D90).
        const copyOf = effect.copy === undefined ? null : effect.copy.of === 'self' ? (source ?? null) : aim?.kind === 'card' ? aim.id : null;
        const copied = copyOf === null ? undefined : state.cards[copyOf];
        if (effect.copy !== undefined && (copied === undefined || copied.faceDown)) {
          out.push(narrated(`${obj.label} — nothing to copy for “${effect.text}”.`, obj.controller, obj.identity));
          break;
        }
        const printing = copied ? { oracleId: copied.oracleId, printingId: copied.printingId } : effect.token;
        if (!printing) break;
        const exceptions = copied ? mergeExceptions(copied.copyExceptions, effect.copy?.exceptions ?? null) : undefined;
        // D504 - the aimed player creates the token (the previous object's controller - Beast Within's Beast is the
        // destroyed permanent's controller's); the caster's otherwise.
        const maker = !effect.self && aim?.kind === 'player' ? aim.id : controller;
        for (let n = 0; n < effect.amount; n++) {
          nextInstance++;
          out.push({
            t: 'TokenCreated',
            card: `c${nextInstance}`,
            oracleId: printing.oracleId,
            printingId: printing.printingId,
            controller: maker,
            owner: maker,
            turnNumber: state.turn.turnNumber,
            ...(copied ? { faceIndex: copied.faceIndex, copyOf: copied.id } : {}),
            ...(exceptions !== undefined ? { copyExceptions: exceptions } : {}),
          });
        }
        if (copied) {
          const name = derive(state, deps.oracle, deps.scripts, copied.id, cache).name;
          out.push(narrated(`${obj.label} — ${effect.amount === 1 ? 'a token that is a copy' : `${effect.amount} tokens that are copies`} of ${name}.`, obj.controller, obj.identity));
        }
        break;
      }

      case 'createEmblem': {
        // D475 - the emblem goes to the controller's command zone (CR 114.1); the printing is the table's.
        if (!effect.token) break;
        nextInstance++;
        out.push({ t: 'EmblemCreated', card: `c${nextInstance}`, oracleId: effect.token.oracleId, printingId: effect.token.printingId, owner: controller });
        break;
      }

      // D505 - THE MASS VERBS OVER A SCOPE: every member the scope reaches (`scopeMembers`, the source left out of an
      // `other` scope) gets the counters, is tapped or is untapped in ONE event, so the object verbs after the clause
      // read the members off it (D500); the marker says how many. A scope that reaches nothing does nothing.
      // The scope is walked over the state the clauses BEFORE it left (the tokens The Crystal's Chosen just made are
      // creatures it controls), so the events so far are applied to a scratch state first - and the derive cache, keyed
      // on the state the resolution began in, is set aside for it.
      case 'massCounters':
      case 'massTap':
      case 'massUntap': {
        if (effect.kind === 'massCounters' && (effect.counterKind === null || effect.amount === 0)) break;
        let now = state;
        for (const body of out) now = apply(now, { seq: now.eventCount, body, cause: { kind: 'system' } } as never);
        const reached = scopeMembers(now, deps, controller, effect.scopes ?? [], now === state ? cache : undefined, source ?? null).cards;
        const members = effect.kind === 'massCounters'
          ? reached.filter((id) => now.cards[id]?.zone.kind === 'battlefield')
          : effect.kind === 'massTap'
            ? reached.filter((id) => now.cards[id]?.tapped !== true)
            : reached.filter((id) => now.cards[id]?.tapped === true);
        out.push({ t: 'ScopeWalked', verb: effect.kind, members: members.length, text: effect.text });
        if (members.length === 0) break;
        if (effect.kind === 'massCounters') out.push({ t: 'CountersChanged', changes: members.map((card) => ({ card, kind: effect.counterKind as CounterKind, delta: effect.amount })) });
        else if (effect.kind === 'massTap') out.push({ t: 'PermanentsTapped', cards: members });
        else out.push({ t: 'PermanentsUntapped', cards: members });
        break;
      }
      case 'putCounters':
      case 'removeCounters': {
        if (aim?.kind !== 'card' || effect.counterKind === null) break;
        if (state.cards[aim.id]?.zone.kind !== 'battlefield') break;
        const delta = effect.kind === 'putCounters' ? effect.amount : -effect.amount;
        if (delta === 0) break;
        out.push({
          t: 'CountersChanged',
          changes: [{ card: aim.id, kind: effect.counterKind, delta }],
        });
        break;
      }
    }
    /**
     * D484 - THE STOP. A question this clause raised carries the clauses after it (`EffectContinuation`): the
     * executor ends here and the answer handler resumes through `resumeContinuation`, so nothing after a question
     * runs before its answer and nothing is dropped - the wall D195 built its ask-last rule around. ONE question
     * per batch is still the rule (a second `AwaitingSet` would overwrite the first); it is kept by stopping, and
     * a second asking clause is simply the first of the continuation. A counted asking clause asks for its first
     * pick only (no vocabulary rule prints one).
     */
    if (rec) rec.end = out.length;
    const asked = out.slice(before).findIndex((e) => e.t === 'AwaitingSet' && e.awaiting !== null);
    if (asked < 0) continue;
    const rest = effects.slice(at + 1);
    const carried = rest.length > 0 ? continuationOf(obj, at, rest, outer) : outer;
    if (carried !== undefined) {
      const k = before + asked;
      const ev = out[k];
      if (ev !== undefined && ev.t === 'AwaitingSet' && ev.awaiting !== null) out[k] = { t: 'AwaitingSet', awaiting: withContinuation(ev.awaiting, carried) };
    }
    break;
  }
  // ⚠️ `rng` is omitted entirely when nothing drew, not set to `state.rng`.
  // `log.ts` records `rngBefore`/`rngAfter` only when a batch carries one, and a
  // no-op advance on every spell would put two identical states on every event.
  return rng === undefined ? { events: out } : { events: out, rng };
}

/**
 * Build the damage record, reusing the SAME shape combat damage uses so infect,
 * wither, deathtouch, lifelink and the commander tally behave identically.
 *
 * ⚠️ `isCommanderDamage` is FALSE here even when the source is a commander:
 * CR 903.10a counts only COMBAT damage toward the 21. A Bolt from your commander
 * is not commander damage, and counting it would kill people early in a way that
 * is very hard to argue with after the fact.
 */
function damageTo(
  state: GameState,
  deps: EngineDeps,
  source: InstanceId,
  aim: Aim,
  amount: number,
  cache?: DeriveCache,
  unpreventable = false,
): ResolvedDamage {
  const d = state.cards[source] ? derive(state, deps.oracle, deps.scripts, source, cache) : null;
  const infect = d?.keywords.has('infect') ?? false;
  const wither = d?.keywords.has('wither') ?? false;
  const applyAs = aim.kind === 'player' && infect ? 'poison' : infect || wither ? 'wither' : 'normal';
  return {
    source,
    target: aim.kind === 'player' ? { kind: 'player', id: aim.id } : { kind: 'card', id: (aim as { id: InstanceId }).id },
    amount,
    deathtouch: d?.keywords.has('deathtouch') ?? false,
    lifelinkTo: d?.keywords.has('lifelink') ? state.cards[source]?.controller ?? null : null,
    isCommanderDamage: false,
    viaTrample: 0,
    toxic: d?.toxicAmount ?? 0,
    applyAs,
    ...(unpreventable ? { unpreventable: true } : {}),
  };
}

/**
 * D383 - ONE reader for every scoped board effect's set (D346's rule: the scope
 * vocabulary lives in a single place, so a scope can never widen a body).
 *
 * ⚠️ Read from the board as it DERIVES NOW, exactly as `massPump` has since D301
 * - a Levitation-granted type counts, a face-down permanent is a 2/2 creature -
 * and from the LIVE combat for an attacking scope, so a sweep cast mid-combat
 * means what the card says.
 */
const MASS_PUMP_SCOPE: BoardScope = { kind: 'creature', controller: 'you' };
/** D390 - CR 101.4: the players who choose, in APNAP order from the active player. */
export function apnapPlayers(state: GameState, players: readonly PlayerId[]): PlayerId[] {
  const seats = state.seating;
  const start = Math.max(0, seats.indexOf(state.turn.activePlayer));
  const out: PlayerId[] = [];
  for (let i = 0; i < seats.length; i++) {
    const p = seats[(start + i) % seats.length];
    if (p !== undefined && players.includes(p)) out.push(p);
  }
  return out;
}

/**
 * D390 - what a player may answer a queued question with: the permanents they control that the
 * printed noun admits (DERIVED - a type-changed permanent is what it is now, as the sacrifice
 * chooser's own offer reads it), or every card in their hand. The host validates a pick against
 * exactly this list.
 */
/**
 * D489 - the suspend tick (CR 702.62c), a delayed trigger armed for the card owner's next upkeep (D402's shape - the
 * fire runs its one clause over the card as the source); it re-arms itself while time counters remain. The id
 * carries the turn, so each arming is its own entry.
 */
export function suspendTick(state: GameState, card: InstanceId, owner: PlayerId, name: string): DelayedTrigger {
  return {
    id: `${card}-suspend-${state.turn.turnNumber}`,
    controller: owner,
    source: card,
    when: { step: 'upkeep', whose: 'controller' },
    armedTurn: state.turn.turnNumber,
    armedStep: state.turn.step,
    effects: [suspendTickSpec()],
    label: `${name} — suspend: remove a time counter`,
  };
}

export function askCandidates(
  state: GameState,
  deps: EngineDeps,
  player: PlayerId,
  verb: 'sacrifice' | 'discard' | 'return' | 'populate',
  filter: LookFilter | null,
  cache?: DeriveCache,
): InstanceId[] {
  if (verb === 'discard') return [...(state.zones.hand[player] ?? [])];
  const out: InstanceId[] = [];
  for (const id of state.zones.battlefield) {
    const inst = state.cards[id];
    if (!inst || inst.controller !== player) continue;
    // D488 - a populate copies a TOKEN (CR 701.31): a card is never a candidate, whatever the noun says.
    if (verb === 'populate' && !inst.isToken) continue;
    if (filter) {
      const d = derive(state, deps.oracle, deps.scripts, id, cache);
      if (!predicateAdmits({ typeLine: d.typeLine, colors: d.colors }, filter.predicates)) continue;
    }
    out.push(id);
  }
  return out;
}

/**
 * D484 - the continuation of `obj`'s resolution from clause `at`: the clauses after it and what the executor reads
 * of the object (`payMana` snapshots the same fields). Its own id keeps a resumed clause's derived ids (a delayed
 * trigger's `-d<n>`, a shield's) apart from the resolution's, which numbered from zero too.
 */
function continuationOf(obj: StackObject, at: number, rest: readonly EffectSpec[], outer: EffectContinuation | undefined): EffectContinuation {
  return {
    effects: rest,
    id: `${obj.id}-c${at}`,
    kind: obj.kind,
    controller: obj.controller,
    card: obj.card,
    source: obj.source,
    identity: obj.identity,
    targets: obj.targets,
    ...(obj.targetSlots !== undefined ? { targetSlots: obj.targetSlots } : {}),
    label: obj.label,
    ...(obj.xValue !== null ? { xValue: obj.xValue } : {}),
    ...(obj.kicked !== undefined ? { kicked: obj.kicked } : {}),
    ...(obj.memo !== undefined ? { memo: obj.memo } : {}),
    ...(outer !== undefined ? { outer } : {}),
  };
}

/** The frame beyond `inner`'s last: a question raised inside a resumed frame keeps the frames the prompt already carried. */
function chained(inner: EffectContinuation, outer: EffectContinuation): EffectContinuation {
  return { ...inner, outer: inner.outer === undefined ? outer : chained(inner.outer, outer) };
}

/**
 * The question with the continuation on it. Only the prompts the executor raises carry one; a prompt that already
 * carries this very continuation (the search's reveal stage re-raises its own) is left alone, and one that carries
 * another (a payment's branch that asked) keeps it and takes this one as the frame beyond.
 */
function withContinuation(awaiting: Awaiting, continuation: EffectContinuation): Awaiting {
  switch (awaiting.kind) {
    case 'payMana':
    case 'searchLibrary':
    case 'chooseFromZone':
    case 'orderCards':
    case 'scryChoice':
    case 'proliferateChoice':
      if (awaiting.continuation === continuation) return awaiting;
      return { ...awaiting, continuation: awaiting.continuation === undefined ? continuation : chained(awaiting.continuation, continuation) };
    // D487 - a copy's new-targets question carries the clauses after the copying one; a cast's own prompt never does.
    case 'chooseTargets':
      if (awaiting.forKind !== 'copy' || awaiting.continuation === continuation) return awaiting;
      return { ...awaiting, continuation: awaiting.continuation === undefined ? continuation : chained(awaiting.continuation, continuation) };
    default:
      return awaiting;
  }
}

/** The object a resumed frame resolves for - what the continuation kept of the one that has left the stack. */
function continuationObject(c: EffectContinuation): StackObject {
  return {
    id: c.id,
    kind: c.kind,
    controller: c.controller,
    card: c.card,
    source: c.source,
    abilityRef: null,
    targets: c.targets,
    ...(c.targetSlots !== undefined ? { targetSlots: c.targetSlots } : {}),
    modes: [],
    xValue: c.xValue ?? null,
    label: c.label,
    identity: c.identity,
    taxApplied: 0,
    isCommanderCast: false,
    castFrom: null,
    faceIndex: 0,
    ...(c.kicked !== undefined ? { kicked: c.kicked } : {}),
    ...(c.memo !== undefined ? { memo: c.memo } : {}),
  };
}

/**
 * D484 - THE ANSWER'S END, one funnel for every prompt the executor raises. The continuation the prompt carried is
 * run against the state the answer's events leave (folded through the pure reducer, the way the scry's rider is
 * emitted - D195 - with the RNG the answer advanced threaded in, so a shuffle before and a draw after never share
 * numbers) and its events are appended; a frame that asks again carries what is left (the executor's stop); a
 * frame that ends runs the frame beyond it. When the answer's own events raised the chain's NEXT question (the
 * ordering after a look, the next player of a queue, the next explore or connive, the reveal stage of an optional
 * search), the continuation is forwarded onto it untouched and nothing runs yet. Returns the RNG the accept carries.
 */
export function resumeContinuation(state: GameState, deps: EngineDeps, events: EventBody[], continuation: EffectContinuation | undefined, rng?: RngState): RngState | undefined {
  let frame = continuation;
  let folded = 0;
  let scratch = state;
  let advanced = rng;
  while (frame !== undefined) {
    const pending = events.slice(folded).findIndex((e) => e.t === 'AwaitingSet' && e.awaiting !== null);
    if (pending >= 0) {
      const k = folded + pending;
      const ev = events[k];
      if (ev !== undefined && ev.t === 'AwaitingSet' && ev.awaiting !== null) events[k] = { t: 'AwaitingSet', awaiting: withContinuation(ev.awaiting, frame) };
      return advanced;
    }
    for (const body of events.slice(folded)) scratch = apply(scratch, { seq: scratch.eventCount, body, cause: { kind: 'system' } } as never);
    folded = events.length;
    if (advanced !== undefined) scratch = { ...scratch, rng: advanced };
    events.push({ t: 'ContinuationResumed', label: frame.label, clauses: frame.effects.length });
    const result = effectResult(scratch, deps, continuationObject(frame), frame.effects, undefined, frame.outer);
    events.push(...result.events);
    if (result.rng !== undefined) advanced = result.rng;
    frame = result.events.some((e) => e.t === 'AwaitingSet' && e.awaiting !== null) ? undefined : frame.outer;
  }
  return advanced;
}

/**
 * D491 - the face of the spell's FIRST target (`it` - the spell the clause before countered or bounced), read off the
 * state the spell resolved against: on the stack, the object's card (a copy's printing); on the battlefield, the
 * permanent's card as printed. Null when the spell aimed at nothing the grant can read (a player).
 */
function referentFace(state: GameState, deps: EngineDeps, obj: StackObject): { readonly name: string; readonly manaValue: number; readonly types: readonly string[] } | null {
  const aim = obj.targets[0];
  if (aim === undefined || aim.kind === 'player') return null;
  if (aim.kind === 'stack') {
    const target = state.stack.find((s) => s.id === aim.id);
    if (target === undefined) return null;
    const inst = target.card === null ? undefined : state.cards[target.card];
    const printing = target.copyOf !== undefined ? deps.oracle.byPrinting(target.copyOf.printingId) : inst ? deps.oracle.byPrinting(inst.printingId) : undefined;
    if (printing === undefined) return null;
    const face = faceOf(printing, target.copyOf?.faceIndex ?? target.faceIndex);
    return { name: face.name, manaValue: printing.manaValue, types: face.typeLine.types };
  }
  const inst = state.cards[aim.id];
  const printing = inst ? deps.oracle.byPrinting(inst.printingId) : undefined;
  if (inst === undefined || printing === undefined) return null;
  const face = faceOf(printing, inst.faceIndex);
  return { name: face.name, manaValue: printing.manaValue, types: face.typeLine.types };
}

/** D485 - CR 707.9b: a copy of a copy keeps the exceptions it found and takes the new clause's on top. D486 - the clone's too. */
export function mergeExceptions(base: CopyExceptions | undefined, more: CopyExceptions | null): CopyExceptions | undefined {
  if (base === undefined) return more ?? undefined;
  if (more === null) return base;
  return {
    ...base,
    ...more,
    ...(base.addTypes !== undefined || more.addTypes !== undefined ? { addTypes: [...(base.addTypes ?? []), ...(more.addTypes ?? [])] } : {}),
    ...(base.addSubtypes !== undefined || more.addSubtypes !== undefined ? { addSubtypes: [...(base.addSubtypes ?? []), ...(more.addSubtypes ?? [])] } : {}),
    ...(base.keywords !== undefined || more.keywords !== undefined ? { keywords: [...(base.keywords ?? []), ...(more.keywords ?? [])] } : {}),
  };
}

/**
 * D390 - the queue's END: every recorded pick moves in ONE `CardsMoved` (the sacrifices - or the
 * discards - are simultaneous, CR 101.4), carrying the reason a watcher reads (D377), and the log
 * says what each player gave up.
 */
export function askBatch(state: GameState, deps: EngineDeps, verb: 'sacrifice' | 'discard' | 'return' | 'populate', chosen: PendingAsks['chosen'], filter: LookFilter | null): EventBody[] {
  // D488 - a populate makes a token that is a copy of each chosen token (CR 701.31) and moves nothing; the copy's
  // id is the state's next (the answer's batch is the first to allocate past it).
  if (verb === 'populate') {
    const out: EventBody[] = [];
    let next = state.counters.instance;
    for (const c of chosen) {
      if (c.cards.length === 0) {
        out.push(narrated(n`${who(state, c.player)} ${vb(c.player, 'has', 'have')} no creature token to populate.`, c.player));
        continue;
      }
      for (const card of c.cards) {
        const copied = state.cards[card];
        if (!copied) continue;
        next += 1;
        out.push({ t: 'TokenCreated', card: `c${next}`, oracleId: copied.oracleId, printingId: copied.printingId, controller: c.player, owner: c.player, turnNumber: state.turn.turnNumber, faceIndex: copied.faceIndex, copyOf: copied.id, ...(copied.copyExceptions !== undefined ? { copyExceptions: copied.copyExceptions } : {}) });
        out.push({ t: 'Populated', player: c.player, token: copied.id, copy: `c${next}` });
        out.push(narrated(n`${who(state, c.player)} ${vb(c.player, 'populates', 'populate')}: a token that is a copy of ${derive(state, deps.oracle, deps.scripts, card).name}.`, c.player));
      }
    }
    return out;
  }
  // D431 - a RETURN goes to the owner's hand and carries no reason (a bounce never has).
  const moves = chosen.flatMap((c) =>
    c.cards.map((card) => ({
      card,
      from: verb === 'discard' ? { kind: 'hand' as const, player: c.player } : { kind: 'battlefield' as const, player: null },
      to: verb === 'return' ? { kind: 'hand' as const, player: state.cards[card]?.owner ?? c.player } : { kind: 'graveyard' as const, player: state.cards[card]?.owner ?? c.player },
      ...(verb === 'return' ? {} : { reason: verb }),
    })),
  );
  const out: EventBody[] = moves.length > 0 ? [{ t: 'CardsMoved', moves }] : [];
  for (const c of chosen) {
    const k = c.cards.length;
    const thing = verb === 'discard' ? (k === 1 ? 'a card' : `${k} cards`) : k === 1 ? `a ${filter?.what ?? 'permanent'}` : `${k} permanents`;
    out.push(
      k === 0
        ? narrated(n`${who(state, c.player)} ${vb(c.player, 'has', 'have')} nothing to ${verb}.`, c.player)
        : verb === 'return'
          ? narrated(n`${who(state, c.player)} ${vb(c.player, 'returns', 'return')} ${thing} to its owner's hand.`, c.player)
          : narrated(n`${who(state, c.player)} ${vb(c.player, verb === 'discard' ? 'discards' : 'sacrifices', verb === 'discard' ? 'discard' : 'sacrifice')} ${thing}.`, c.player),
    );
  }
  return out;
}

function queueAsks(
  state: GameState,
  deps: EngineDeps,
  controller: PlayerId,
  verb: 'sacrifice' | 'discard' | 'return' | 'populate',
  scopes: readonly BoardScope[],
  count: number,
  filter: LookFilter | null,
  label: string,
  cache?: DeriveCache,
  /** D482 - the players named outright (a `target` scope resolved to the aimed player), instead of the scopes' members. */
  only?: readonly PlayerId[],
): EventBody[] {
  const order = apnapPlayers(state, only ?? scopeMembers(state, deps, controller, scopes, cache).players);
  const chosen: { player: PlayerId; cards: InstanceId[] }[] = [];
  const remaining: PlayerId[] = [];
  let first: PlayerId | null = null;
  for (const p of order) {
    if (first !== null) { remaining.push(p); continue; }
    const cands = askCandidates(state, deps, p, verb, filter, cache);
    // No more legal choices than the count is no choice at all (D137's rule for a hand, CR 701.8a).
    if (cands.length <= count) { chosen.push({ player: p, cards: cands }); continue; }
    first = p;
  }
  if (first === null) return askBatch(state, deps, verb, chosen, filter);
  const pending: PendingAsks = { verb, remaining, count, filter, label, chosen };
  return [
    { t: 'AsksQueued', pending },
    {
      t: 'AwaitingSet',
      awaiting: { kind: 'chooseFromZone', player: first, zone: verb === 'discard' ? 'hand' : 'battlefield', rest: null, count, ...(filter ? { filter } : {}), label },
    },
  ];
}

function scopeMembers(
  state: GameState,
  deps: EngineDeps,
  controller: PlayerId,
  scopes: readonly BoardScope[],
  cache?: DeriveCache,
  /** D505 - the source an `other` scope leaves out. */
  exclude?: InstanceId | null,
): { cards: InstanceId[]; players: PlayerId[] } {
  const cards: InstanceId[] = [];
  const players: PlayerId[] = [];
  const attacking = new Set((state.combat?.attackers ?? []).map((a) => a.card));
  for (const scope of scopes) {
    if (scope.kind === 'player') {
      for (const p of state.seating) {
        if (scope.controller === 'opponents' && p === controller) continue;
        // D425 - `you`: the controller alone (the pain family's `deals N damage to you`).
        if (scope.controller === 'you' && p !== controller) continue;
        if (!players.includes(p)) players.push(p);
      }
      continue;
    }
    for (const id of state.zones.battlefield) {
      const inst = state.cards[id];
      if (!inst || cards.includes(id)) continue;
      if (scope.controller === 'you' && inst.controller !== controller) continue;
      if (scope.controller === 'opponents' && inst.controller === controller) continue;
      const d = derive(state, deps.oracle, deps.scripts, id, cache);
      if (scope.kind === 'creature' && !d.typeLine.types.includes('Creature')) continue;
      if (scope.kind === 'permanent' && scope.type !== undefined && !d.typeLine.types.includes(scope.type)) continue;
      if (scope.attacking === true && !attacking.has(id)) continue;
      if (scope.keyword !== undefined && d.keywords.has(scope.keyword) === (scope.keywordAbsent === true)) continue;
      // D505 - `other` (not the source), a subtype, `nonland`.
      if (scope.other === true && exclude !== undefined && exclude !== null && id === exclude) continue;
      if (scope.subtype !== undefined && !d.typeLine.subtypes.includes(scope.subtype)) continue;
      if (scope.nonland === true && d.typeLine.types.includes('Land')) continue;
      cards.push(id);
    }
  }
  return { cards, players };
}

function moveTo(card: InstanceId, kind: 'graveyard' | 'exile' | 'hand', player: PlayerId, reason?: MoveReason): EventBody {
  return {
    t: 'CardsMoved',
    moves: [{ card, from: { kind: 'battlefield', player: null }, to: { kind, player }, ...(reason ? { reason } : {}) }],
  };
}

// ⚠️ Exported since D170 (the `drawEvents` precedent): a card script that
// counters a spell must move the card by THE one rule, not a copy of it.
export function moveFromStack(card: InstanceId, kind: 'graveyard' | 'exile', player: PlayerId): EventBody {
  return {
    t: 'CardsMoved',
    moves: [{ card, from: { kind: 'stack', player: null }, to: { kind, player } }],
  };
}

/**
 * Draw N, or lose on the next state-based action if the library cannot pay.
 *
 * ⚠️ Drawing from an empty library does NOT lose the game here — it sets the
 * flag and the SBA does it (CR 704.5b). Doing it inline would skip the pass that
 * every other loss goes through.
 *
 * ⚠️ EXPORTED FOR THE CARD SCRIPTS (M6.4a, D158), and only for them: a shipped
 * ETB draw (`Wall of Omens`) must route through THE one draw rule, or the
 * empty-library flag would be re-derived in `scripts/cards/` and eventually
 * disagree with this copy about what an empty library means.
 */
/**
 * D434 - a mill (CR 701.13): the top `count` cards of the player's library into their graveyard, top card first,
 * as one `CardsMoved`. Not a draw: no `DrewCards` marker, no empty-library flag - a short library mills what it
 * has. ⚠️ Exported for the generated card scripts for `drawEvents`' reason: one reader of which end is the top.
 */
/**
 * D437 - the state the clauses so far have left, for a clause that reads a library's TOP: a mill before a draw in one
 * resolution moved the top already (Thought Scour, Mental Note - the fuzz's seed 297 drew a card its own mill had put
 * in the graveyard). Folded only when an event so far moved a card into or out of a library; the pre-batch state
 * serves otherwise (the fold costs a reducer pass per event).
 */
function afterLibraryMoves(state: GameState, out: readonly EventBody[]): GameState {
  if (!out.some((e) => e.t === 'CardsMoved' && e.moves.some((m) => m.from.kind === 'library' || m.to.kind === 'library'))) return state;
  let scratch = state;
  for (const body of out) scratch = apply(scratch, { seq: scratch.eventCount, body, cause: { kind: 'system' } } as never);
  return scratch;
}

export function millEvents(state: GameState, player: PlayerId, count: number): EventBody[] {
  const library = state.zones.library[player] ?? [];
  const take = Math.min(count, library.length);
  if (take <= 0) return [];
  const ids = library.slice(library.length - take).reverse();
  return [{ t: 'CardsMoved', moves: ids.map((card) => ({ card, from: { kind: 'library' as const, player }, to: { kind: 'graveyard' as const, player } })) }];
}

export function drawEvents(state: GameState, player: PlayerId, count: number): EventBody[] {
  const library = state.zones.library[player] ?? [];
  // ⚠️ The SAME helper the draw step and the mulligan use. A second "take N off
  // the top" would eventually disagree about which end of the array is the top,
  // and the disagreement would only show up as a shuffled-looking library.
  const out: EventBody[] = [...drawFromTop(player, count, library)];
  const marker = drewCardsMarker(player, out);
  if (marker) out.push(marker);
  if (library.length < count) out.push({ t: 'DrewFromEmptyLibrary', player });
  return out;
}

/**
 * The `DrewCards` marker for a REAL draw (CR 121), derived from the moves the
 * draw just produced — never recomputed from the library, so the ids and
 * their DRAW ORDER cannot drift from what actually moved. Returns null when
 * nothing was drawn (an empty library draws no cards; the loss flag travels
 * separately).
 *
 * ⚠️ Called at exactly TWO sites — here and the turn's draw step — and never
 * by `drawFromTop` itself, which the opening hands share: an opening hand is
 * not a draw an ability can watch, and an Impulse-style take must stay
 * indistinguishable from silence (D179's discriminator is the whole point).
 */
export function drewCardsMarker(player: PlayerId, events: readonly EventBody[]): EventBody | null {
  const ids: InstanceId[] = [];
  for (const e of events) {
    if (e.t !== 'CardsMoved') continue;
    for (const m of e.moves) {
      if (m.from.kind === 'library' && m.to.kind === 'hand') ids.push(m.card);
    }
  }
  return ids.length > 0 ? { t: 'DrewCards', player, cards: ids } : null;
}
