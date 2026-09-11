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
import { SELF_AIMED, type BoardScope, type EffectSpec, type LookFilter } from './types/oracle';
import { predicateAdmits } from '../data/replacementParse';
import { faceOf } from './oracle';
import { apply } from './reducer';
import { proliferateCandidates } from './proliferate';
import type { GameState, PendingAsks, StackObject, TargetChoice } from './types/state';
// Every line here has a CARD as its subject ("Lightning Bolt counters Negate."),
// so none of them changes person for the reader and none needs parts.
import { n, narrated, vb, who } from './narrate';
import { drawFromTop } from './setup';
import { buildPaymentProblem } from './mana';
import { solveInputFor, suggestPayment } from './payment';
import type { PlayerId as Payer } from './types/ids';

/** The thing a clause is pointed at, already checked for still being there. */
type Aim =
  | { readonly kind: 'card'; readonly id: InstanceId; readonly controller: PlayerId; readonly owner: PlayerId }
  | { readonly kind: 'player'; readonly id: PlayerId }
  | { readonly kind: 'stack'; readonly id: string };

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
export function effectResult(
  state: GameState,
  deps: EngineDeps,
  obj: StackObject,
  effects: readonly EffectSpec[],
  cache?: DeriveCache,
): { events: EventBody[]; rng?: RngState } {
  const out: EventBody[] = [];
  // ⚠️ Threaded through the loop and returned ONCE at the end, never read from
  // `state` per clause: two clauses that each drew from `state.rng` would draw
  // the SAME numbers, because nothing between them advanced it.
  let rng: RngState | undefined;
  const controller = obj.controller;
  const source = obj.card ?? obj.source;
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
  const steps: { effect: EffectSpec; aim: Aim | null; missing: boolean }[] = [];
  for (const effect of effects) {
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
    const aims = picks.map((c) => aimOf(state, c)).filter((a): a is Aim => a !== null);
    if (aims.length === 0) {
      if (!(effect.optional === true && picks.length === 0)) steps.push({ effect, aim: null, missing: true });
      continue;
    }
    for (const aim of aims) steps.push({ effect, aim, missing: false });
  }

  for (const { effect, aim, missing } of steps) {
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

    switch (effect.kind) {
      case 'damage': {
        if (!aim || aim.kind === 'stack' || !source) break;
        // D382 - CR 615.9. The clause rides the same effects, exactly as
        // `noRegenerate` does for the destroy above.
        const unpreventable = effects.some((e) => e.cantBePrevented === true);
        out.push({
          t: 'DamageDealt',
          damages: [damageTo(state, deps, source, aim, effect.amount, cache, unpreventable)],
        });
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
        const recipient =
          effect.preventScope === 'any'
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
        shieldSeq += 1;
        out.push({
          t: 'PreventionShieldsAdded',
          shields: [
            {
              id: `sh${obj.id}:${shieldSeq}`,
              amount,
              combatOnly: effect.preventCombatOnly === true,
              recipient,
            },
          ],
        });
        break;
      }

      case 'destroy': {
        if (aim?.kind !== 'card') break;
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
        out.push(moveTo(aim.id, 'graveyard', aim.owner));
        break;
      }

      case 'exile': {
        if (aim?.kind !== 'card') break;
        // Exile is not destruction: indestructible does not save it (CR 701.10a).
        out.push(moveTo(aim.id, 'exile', aim.owner));
        break;
      }

      case 'bounce': {
        if (aim?.kind !== 'card') break;
        out.push(moveTo(aim.id, 'hand', aim.owner));
        break;
      }

      case 'counter': {
        if (aim?.kind !== 'stack') break;
        const victim = state.stack.find((s) => s.id === aim.id);
        if (!victim) break;
        // D336 - "This spell can't be countered.": the funnel would drop the
        // counter anyway; saying so here keeps the resolver's own line honest.
        const victimCard = victim.card === null ? undefined : state.cards[victim.card];
        if (victimCard && deps.scripts.get(victimCard.oracleId)?.cantBeCountered !== undefined) {
          out.push(narrated(`${victim.label} can't be countered.`, obj.controller, obj.identity));
          break;
        }
        out.push({ t: 'SpellCountered', stackId: victim.id });
        // A countered SPELL goes to its owner's graveyard; an ability just ceases.
        // D307 - a spell cast by flashback goes to exile instead (CR 702.34a).
        if (victim.card) {
          const vc = state.cards[victim.card];
          if (vc) out.push(moveFromStack(victim.card, victim.castFrom?.kind === 'graveyard' ? 'exile' : 'graveyard', vc.owner));
        }
        out.push(narrated(`${obj.label} counters ${victim.label}.`, obj.controller, obj.identity));
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
        if (damages.length > 0) out.push({ t: 'DamageDealt', damages });
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
        if (gained > 0 && me) out.push({ t: 'LifeChanged', player: controller, delta: gained, to: me.life + gained });
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
        const problem = buildPaymentProblem(pay.cost, 0, [], 0, pay.life);
        const can =
          !!seat && seat.life >= pay.life && (pay.cost === null || suggestPayment(solveInputFor(state, deps.oracle, deps.scripts, payer, cache), problem) !== null);
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
            cost: pay.cost,
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
          },
        });
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
        out.push(...queueAsks(state, deps, controller, 'sacrifice', effect.scopes ?? [], effect.amount, filter, obj.label, cache));
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

      case 'untap': {
        if (aim?.kind !== 'card') break;
        if (!state.cards[aim.id]?.tapped) break;
        out.push({ t: 'PermanentsUntapped', cards: [aim.id] });
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
        out.push(...drawEvents(state, controller, effect.amount));
        break;
      }

      case 'gainLife': {
        const p = state.players[controller];
        if (!p) break;
        out.push({ t: 'LifeChanged', player: controller, delta: effect.amount, to: p.life + effect.amount });
        break;
      }

      case 'loseLife': {
        // D295: `self` is the controller ("You lose 3 life."); otherwise the aimed player.
        const who = effect.self ? controller : aim?.kind === 'player' ? aim.id : null;
        if (!who) break;
        const p = state.players[who];
        if (!p) break;
        out.push({ t: 'LifeChanged', player: who, delta: -effect.amount, to: p.life - effect.amount });
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
          out.push(...drawEvents(state, who, effect.amount));
          break;
        }
        const p = state.players[who];
        if (!p) break;
        out.push({ t: 'LifeChanged', player: who, delta: -effect.amount, to: p.life - effect.amount });
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
       * clauses would ask about one and drop the other — half-execution. No card
       * in this vocabulary can print two (each is a whole anchored sentence
       * naming one target), and the guard is here so that stays true rather than
       * being true by luck.
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
      case 'returnFromGraveyard': {
        if (aim?.kind !== 'card') break;
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
        if (aim?.kind !== 'card') break;
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
        const library = state.zones.library[controller] ?? [];
        if (library.length === 0) break;
        // The TOP of a library is the END of the array (`drawFromTop`).
        const top = library.slice(Math.max(0, library.length - effect.amount));
        out.push({ t: 'CardsRevealed', cards: top, to: [controller] });
        const take = Math.min(look.take, top.length);
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
        if (take >= top.length && !look.filter && !look.optional) {
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
            min: look.optional ? 0 : take,
            filter: look.filter,
            label: obj.label,
          },
        });
        break;
      }

      case 'search': {
        const spec = effect.search;
        if (!spec) break;
        const lib = state.zones.library[controller] ?? [];
        // An empty library asks nothing - there is no choice to make (D137's rule).
        if (lib.length === 0) break;
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
        if (!spec.optional) out.push({ t: 'CardsRevealed', cards: lib, to: [controller] });
        out.push({
          t: 'AwaitingSet',
          awaiting: {
            kind: 'searchLibrary',
            player: controller,
            count: spec.count,
            what: spec.label,
            predicates: spec.predicates,
            destination: spec.destination,
            tapped: spec.tapped,
            shuffle: spec.shuffle,
            label: obj.label,
            optional: spec.optional,
            qualifier: spec.qualifier,
          },
        });
        break;
      }

      case 'discard': {
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
        const library = state.zones.library[controller] ?? [];
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
        if (!effect.token) break;
        for (let n = 0; n < effect.amount; n++) {
          nextInstance++;
          out.push({
            t: 'TokenCreated',
            card: `c${nextInstance}`,
            oracleId: effect.token.oracleId,
            printingId: effect.token.printingId,
            controller,
            owner: controller,
            turnNumber: state.turn.turnNumber,
          });
        }
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
export function askCandidates(
  state: GameState,
  deps: EngineDeps,
  player: PlayerId,
  verb: 'sacrifice' | 'discard',
  filter: LookFilter | null,
  cache?: DeriveCache,
): InstanceId[] {
  if (verb === 'discard') return [...(state.zones.hand[player] ?? [])];
  const out: InstanceId[] = [];
  for (const id of state.zones.battlefield) {
    const inst = state.cards[id];
    if (!inst || inst.controller !== player) continue;
    if (filter) {
      const d = derive(state, deps.oracle, deps.scripts, id, cache);
      if (!predicateAdmits({ typeLine: d.typeLine, colors: d.colors }, filter.predicates)) continue;
    }
    out.push(id);
  }
  return out;
}

/**
 * D390 - the queue's END: every recorded pick moves in ONE `CardsMoved` (the sacrifices - or the
 * discards - are simultaneous, CR 101.4), carrying the reason a watcher reads (D377), and the log
 * says what each player gave up.
 */
export function askBatch(state: GameState, verb: 'sacrifice' | 'discard', chosen: PendingAsks['chosen'], filter: LookFilter | null): EventBody[] {
  const moves = chosen.flatMap((c) =>
    c.cards.map((card) => ({
      card,
      from: verb === 'sacrifice' ? { kind: 'battlefield' as const, player: null } : { kind: 'hand' as const, player: c.player },
      to: { kind: 'graveyard' as const, player: state.cards[card]?.owner ?? c.player },
      reason: verb,
    })),
  );
  const out: EventBody[] = moves.length > 0 ? [{ t: 'CardsMoved', moves }] : [];
  for (const c of chosen) {
    const k = c.cards.length;
    const thing = verb === 'discard' ? (k === 1 ? 'a card' : `${k} cards`) : k === 1 ? `a ${filter?.what ?? 'permanent'}` : `${k} permanents`;
    out.push(
      k === 0
        ? narrated(n`${who(state, c.player)} ${vb(c.player, 'has', 'have')} nothing to ${verb}.`, c.player)
        : narrated(n`${who(state, c.player)} ${vb(c.player, verb === 'discard' ? 'discards' : 'sacrifices', verb === 'discard' ? 'discard' : 'sacrifice')} ${thing}.`, c.player),
    );
  }
  return out;
}

function queueAsks(
  state: GameState,
  deps: EngineDeps,
  controller: PlayerId,
  verb: 'sacrifice' | 'discard',
  scopes: readonly BoardScope[],
  count: number,
  filter: LookFilter | null,
  label: string,
  cache?: DeriveCache,
): EventBody[] {
  const order = apnapPlayers(state, scopeMembers(state, deps, controller, scopes, cache).players);
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
  if (first === null) return askBatch(state, verb, chosen, filter);
  const pending: PendingAsks = { verb, remaining, count, filter, label, chosen };
  return [
    { t: 'AsksQueued', pending },
    {
      t: 'AwaitingSet',
      awaiting: { kind: 'chooseFromZone', player: first, zone: verb === 'sacrifice' ? 'battlefield' : 'hand', rest: null, count, ...(filter ? { filter } : {}), label },
    },
  ];
}

function scopeMembers(
  state: GameState,
  deps: EngineDeps,
  controller: PlayerId,
  scopes: readonly BoardScope[],
  cache?: DeriveCache,
): { cards: InstanceId[]; players: PlayerId[] } {
  const cards: InstanceId[] = [];
  const players: PlayerId[] = [];
  const attacking = new Set((state.combat?.attackers ?? []).map((a) => a.card));
  for (const scope of scopes) {
    if (scope.kind === 'player') {
      for (const p of state.seating) {
        if (scope.controller === 'opponents' && p === controller) continue;
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
