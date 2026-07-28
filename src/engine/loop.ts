// `advance()` — one unit of engine work. `pump()` — repeat until blocked.
//
// ⚠️ THE ORDER IN `advance()` IS THE RULES. State-based actions, then the
// trigger drain, then the input check, then turn-based actions, then priority.
// CR 117.5 says SBAs and triggers are handled whenever a player *would* receive
// priority, repeatedly, until none apply — and BEFORE they actually get it.
// Making those the first two branches and having `pump()` loop is what makes
// that closure structural instead of a hand-rolled `while` in one call site
// that somebody eventually forgets to call.
//
// ⚠️ `advance()` returns `[]` in exactly two situations: the game is finished,
// or it is blocked on a human (`priority.awaiting !== null`). Those are the only
// two places the engine stops.

import { assignBlockerDamage, creaturesInCombat, canAttack, legalDefenders, needsFirstStrikeSubstep, resolveCombatDamage } from './combat';
import { derive, makeDeriveCache } from './derive';
import { effectEvents } from './effects';
import { candidatesFromState, targetAllowed, untargetableByRule } from './targets';
import { checkGameOver, checkStateBasedActions } from './sba';
import { emitted, type Emitted } from './log';
import { faceOf } from './oracle';
import { n, narrated, their, they, vb, who } from './narrate';
import { drawFromTop, mulligansComplete } from './setup';
import { orderTriggersApnap } from './triggers';
import { grantsPriority, nextStep, skipsFirstDraw } from './turn';
import { shouldAutoPass, legalActions } from './legal';
import type { ScriptRegistry } from './scripts/registry';
import type { EventBody, GameEvent, ResolvedDamage } from './types/events';
import type { InstanceId, PlayerId } from './types/ids';
import { EMPTY_POOL, poolTotal } from './types/mana';
import type { OracleDb, OracleFace } from './types/oracle';
import { apnapOrder, livingPlayers, type Awaiting, type GameState, type StackObject } from './types/state';
import { canBlock } from './combat';

export interface EngineDeps {
  readonly oracle: OracleDb;
  readonly scripts: ScriptRegistry;
}

/** Exceeding this is a bug, not a long game. The throw carries the tail. */
export const MAX_ITER = 10_000;

export function advance(state: GameState, deps: EngineDeps): Emitted {
  if (state.gamePhase === 'finished' || state.gamePhase === 'lobby') return emitted([]);
  if (state.gamePhase === 'mulligan') return advanceMulligan(state);

  // 1 — state-based actions. Repeat until a pass yields nothing (CR 704.4);
  // `pump` provides the repetition.
  const sba = checkStateBasedActions(state, deps.oracle, deps.scripts);
  if (sba.actions.length > 0) {
    const events = [...sba.events];
    // CR 514.3a — an SBA during cleanup means players DO get priority, and
    // another cleanup step follows.
    if (state.turn.step === 'cleanup' && !state.turn.cleanupNeedsRepeat) {
      events.push({ t: 'CleanupRepeatSet', value: true });
    }
    return emitted(events);
  }

  const over = state.seating.length > 1 ? checkGameOver(state) : [];
  if (over.length > 0) return emitted(over);

  // 2 — trigger drain, APNAP (CR 603.3b).
  if (state.pendingTriggers.length > 0) return drainTriggers(state);

  // 3 — blocked on a human. The engine stops here and nowhere else.
  if (state.priority.awaiting !== null) return emitted([]);

  // 4 — turn-based actions for this step.
  if (!state.turn.turnBasedActionsDone) return turnBasedActions(state, deps);

  // 5 — priority.
  return priority(state, deps);
}

// ── mulligan phase ───────────────────────────────────────────────────────────

function advanceMulligan(state: GameState): Emitted {
  if (mulligansComplete(state)) {
    const startingPlayer = state.turn.activePlayer;
    return emitted([
      { t: 'GamePhaseChanged', phase: 'playing' },
      { t: 'AwaitingSet', awaiting: null },
      { t: 'TurnBegan', turnNumber: 1, activePlayer: startingPlayer },
      narrated(
        state.seating.length === 2
          // "they skip" and "you skip" are the same verb form, so there is no
          // verb part here — only the pronouns change.
          ? n`Turn 1 — ${who(state, startingPlayer)}. ${they(startingPlayer)} skip ${their(startingPlayer)} first draw (CR 103.7b).`
          // "their" here is everyone's, not this player's, so it stays literal.
          : n`Turn 1 — ${who(state, startingPlayer)}. Everyone draws on their first turn (CR 103.7a).`,
        startingPlayer,
      ),
      { t: 'StepBegan', phase: 'beginning', step: 'untap' },
    ]);
  }
  // ⚠️ Bottoming outranks deciding. A player who kept but still owes cards to
  // the bottom is NOT waiting to keep, and re-arming the keep/mulligan prompt
  // over their bottoming prompt made the game unwinnable-looking: the "put 2 on
  // the bottom" dialog vanished the instant it appeared, every time.
  const owing = state.seating.filter((id) => {
    const p = state.players[id];
    return !!p && p.mulligan.kept && p.mulligan.toBottom > 0;
  });
  const head = owing[0];
  if (head) {
    const count = state.players[head]?.mulligan.toBottom ?? 0;
    const current = state.priority.awaiting;
    if (current?.kind === 'mulliganBottom' && current.player === head && current.count === count) {
      return emitted([]);
    }
    return emitted([{ t: 'AwaitingSet', awaiting: { kind: 'mulliganBottom', player: head, count } }]);
  }

  const pending = state.seating.filter((id) => !(state.players[id]?.mulligan.kept ?? true));
  const submitted = state.seating.filter((id) => !pending.includes(id));
  const current = state.priority.awaiting;
  if (
    current?.kind === 'mulligan' &&
    sameIds(current.players, pending) &&
    sameIds(current.submitted, submitted)
  ) {
    return emitted([]);
  }
  return emitted([{ t: 'AwaitingSet', awaiting: { kind: 'mulligan', players: pending, submitted } }]);
}

function sameIds(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((x, i) => b[i] === x);
}

// ── triggers ─────────────────────────────────────────────────────────────────

function drainTriggers(state: GameState): Emitted {
  const ordered = orderTriggersApnap(state, state.pendingTriggers);
  const byController = new Map<PlayerId, typeof ordered>();
  for (const t of ordered) byController.set(t.controller, [...(byController.get(t.controller) ?? []), t]);

  for (const [controller, list] of byController) {
    if (list.length >= 2) {
      const awaiting: Awaiting = {
        kind: 'orderTriggers',
        player: controller,
        triggers: list.map((t) => t.id),
      };
      return emitted([{ t: 'AwaitingSet', awaiting }]);
    }
  }

  // ⚠️ APNAP puts the ACTIVE player's triggers on the stack first, so the
  // non-active player's end up on top and resolve first. Reversing this is the
  // classic off-by-one in a trigger bus, and it is invisible until two triggers
  // fight over the same object.
  const events: EventBody[] = [];
  let stackCounter = state.counters.stack;
  for (const trigger of ordered) {
    stackCounter++;
    const obj: StackObject = {
      id: `s${stackCounter}`,
      kind: 'triggered',
      controller: trigger.controller,
      card: null,
      source: trigger.source,
      abilityRef: trigger.abilityRef,
      targets: [],
      modes: [],
      xValue: null,
      label: trigger.label,
      identity: [],
      taxApplied: 0,
      isCommanderCast: false,
      castFrom: null,
    };
    events.push({ t: 'AbilityPutOnStack', obj });
    events.push(
      narrated(n`${who(state, trigger.controller)}: ${trigger.label}`, trigger.controller),
    );
  }
  events.push({ t: 'PendingTriggersCleared', ids: ordered.map((t) => t.id) });
  return emitted(events);
}

// ── turn-based actions (CR 703) ──────────────────────────────────────────────

function turnBasedActions(state: GameState, deps: EngineDeps): Emitted {
  const events: EventBody[] = [];
  const ap = state.turn.activePlayer;

  switch (state.turn.step) {
    case 'untap': {
      const toUntap = state.zones.battlefield.filter((id) => {
        const card = state.cards[id];
        return !!card && card.controller === ap && card.tapped && !card.phasedOut;
      });
      if (toUntap.length > 0) events.push({ t: 'PermanentsUntapped', cards: toUntap });
      events.push(narrated(n`Turn ${state.turn.turnNumber} — ${who(state, ap)}.`, ap));
      break;
    }

    case 'draw': {
      if (!skipsFirstDraw(state)) {
        const library = state.zones.library[ap] ?? [];
        if (library.length === 0) {
          // CR 704.5b: the loss happens on the NEXT state-based-action check,
          // not now, so a replacement effect has a window.
          events.push({ t: 'DrewFromEmptyLibrary', player: ap });
          events.push(
            narrated(
              // "cannot" is a modal — one form for both persons, so no verb part.
              n`${who(state, ap)} cannot draw — ${their(ap)} library is empty.`,
              ap,
            ),
          );
        } else {
          events.push(...drawFromTop(ap, 1, library));
          events.push(narrated(n`${who(state, ap)} ${vb(ap, 'draws', 'draw')} a card.`, ap));
        }
      }
      break;
    }

    case 'beginCombat':
      events.push({ t: 'CombatBegan' });
      break;

    case 'declareAttackers': {
      const deps2 = { state, oracle: deps.oracle, scripts: deps.scripts, cache: makeDeriveCache(state) };
      const possible = state.zones.battlefield.filter((id) => canAttack(deps2, id));
      if (possible.length === 0) {
        // No prompt when there is nothing to decide. On a four-player table this
        // removes one forced click per player per turn.
        events.push({ t: 'AttackersDeclared', attackers: [] });
        events.push({ t: 'FirstStrikeSubstepDecided', needed: false });
      } else {
        // ⚠️ The prompt carries the legal choices because a client cannot
        // compute them: `canAttack` and `legalDefenders` read a `GameState` no
        // client holds. Until this shipped the UI hardcoded "the first
        // opponent", so nobody at a 3–4 player table could choose whom they
        // attacked — the engine had supported per-attacker defenders all along.
        events.push({
          t: 'AwaitingSet',
          awaiting: {
            kind: 'declareAttackers',
            player: ap,
            attackers: possible,
            defenders: legalDefenders(deps2, ap),
          },
        });
        return emitted(events);
      }
      break;
    }

    case 'declareBlockers': {
      const combat = state.combat;
      if (!combat || combat.attackers.length === 0) {
        events.push({ t: 'BlockersDeclared', blocks: [] });
        events.push({ t: 'FirstStrikeSubstepDecided', needed: needsFirstStrikeSubstep({ state, ...deps }) });
        break;
      }
      const prompt = blockPrompt(state, deps);
      if (prompt.players.length === 0) {
        events.push({ t: 'BlockersDeclared', blocks: [] });
        events.push({ t: 'FirstStrikeSubstepDecided', needed: needsFirstStrikeSubstep({ state, ...deps }) });
        break;
      }
      events.push({
        t: 'AwaitingSet',
        awaiting: {
          kind: 'declareBlockers',
          players: prompt.players,
          submitted: [],
          legal: prompt.legal,
        },
      });
      return emitted(events);
    }

    case 'firstStrikeDamage':
    case 'combatDamage': {
      const substep = state.turn.step === 'firstStrikeDamage' ? 'firstStrike' : 'regular';
      const damages = resolveCombatDamage({ state, ...deps, cache: makeDeriveCache(state) }, substep);
      if (damages.length > 0) {
        events.push({ t: 'CombatDamageDealt', substep, damages });
        events.push(...damageSideEffects(state, damages));
      }
      break;
    }

    default:
      break;
  }

  events.push({ t: 'TurnBasedActionsDone' });
  return emitted(events);
}

/**
 * Who gets asked to block, and — in the SAME pass — exactly which of their
 * creatures may block which attackers.
 *
 * ⚠️ The matrix is returned rather than recomputed because the pairing was
 * already being calculated here to decide who to prompt at all; throwing it away
 * and having a client guess at it is what made an aim veil impossible for
 * blocks. `canBlock` reads DERIVED keywords, so no client can reproduce it.
 */
function blockPrompt(
  state: GameState,
  deps: EngineDeps,
): { players: PlayerId[]; legal: { blocker: InstanceId; attackers: InstanceId[] }[] } {
  const combat = state.combat;
  if (!combat) return { players: [], legal: [] };
  const cache = makeDeriveCache(state);
  const cdeps = { state, oracle: deps.oracle, scripts: deps.scripts, cache };
  const players: PlayerId[] = [];
  const legal: { blocker: InstanceId; attackers: InstanceId[] }[] = [];

  for (const id of state.seating) {
    if (state.players[id]?.hasLost) continue;
    const defendsSomething = combat.attackers.some((a) =>
      a.defender.kind === 'player'
        ? a.defender.id === id
        : state.cards[a.defender.id]?.controller === id,
    );
    if (!defendsSomething) continue;

    let any = false;
    for (const bid of state.zones.battlefield) {
      if (state.cards[bid]?.controller !== id) continue;
      const attackers = combat.attackers
        .filter((a) => canBlock(cdeps, bid, a.card) === null)
        .map((a) => a.card);
      if (attackers.length === 0) continue;
      legal.push({ blocker: bid, attackers });
      any = true;
    }
    // ⚠️ A player with no LEGAL block is auto-submitted with an empty
    // declaration rather than prompted. Otherwise the whole table waits on
    // someone whose only creature is tapped, with no way to say "I can't".
    if (any) players.push(id);
  }
  return { players, legal };
}

/**
 * Life loss, commander tallies and the log lines that come out of a damage
 * event. The damage marks themselves are folded by the reducer.
 */
export function damageSideEffects(state: GameState, damages: readonly ResolvedDamage[]): EventBody[] {
  const events: EventBody[] = [];
  const tally = new Map<string, number>();
  for (const damage of damages) {
    if (!damage.isCommanderDamage || damage.target.kind !== 'player') continue;
    const key = `${damage.target.id}|${damage.source}`;
    tally.set(key, (tally.get(key) ?? 0) + damage.amount);
  }
  for (const [key, amount] of tally) {
    const cut = key.indexOf('|');
    const player = key.slice(0, cut);
    const from = key.slice(cut + 1);
    const before = state.players[player]?.commanderDamage[from] ?? 0;
    events.push({ t: 'CommanderDamageDealt', player, from, amount, total: before + amount });
  }
  return events;
}

// ── priority ─────────────────────────────────────────────────────────────────

/**
 * ⚠️ Granting priority and DECIDING what to do with it are two separate
 * iterations, deliberately.
 *
 * The first emits `PriorityGranted` and nothing else; the next sees the granted
 * state and either auto-passes or stops. The alternative — deciding both in one
 * batch — means `shouldAutoPass` has to run against a state that does not yet
 * say who has priority, and `legalActions` (which checks exactly that) returns
 * an empty list, so every player auto-passes always. Splitting it also gives
 * the same code path to "a player just cast something and still holds
 * priority" (CR 117.3c), which otherwise needs its own branch.
 */
function priority(state: GameState, deps: EngineDeps): Emitted {
  if (!grantsPriority(state)) return endStep(state, deps);

  const living = livingPlayers(state);
  if (living.length === 0) return emitted([]);
  const passed = state.priority.passedSinceLastAction;
  const holder = state.priority.player;

  if (holder !== null && living.includes(holder) && !passed.includes(holder)) {
    // ⚠️ HoldPriority suppresses auto-pass until the holder actually PASSES,
    // not for exactly one action as the spec sketched. Clearing it after one
    // action means a player who holds priority, casts a spell, and then has
    // nothing else affordable is auto-passed instantly — which is the exact
    // situation the toggle exists to prevent, and makes the button look broken.
    // It is a toggle in the UI, so it behaves like one. See DECISIONS D36.
    if (state.priority.holdingPriority === holder) return emitted([]);
    // ⚠️ A disconnected player PAUSES the game indefinitely (spec Q6) rather
    // than being auto-passed. Anyone may click "pass for <name>", and every
    // such pass is a logged event — the right mechanism under a friends-only
    // trust model: social, visible, and undoable by rewind.
    if (state.players[holder]?.connected === false) return emitted([]);
    if (shouldAutoPass(state, deps.oracle, deps.scripts, holder)) {
      return emitted([{ t: 'PriorityPassed', player: holder, auto: true, forced: false }]);
    }
    return emitted([]);
  }

  if (living.every((p) => passed.includes(p))) {
    if (state.stack.length > 0) return resolveTop(state, deps);
    return endStep(state, deps);
  }

  const order = apnapOrder(state).filter((p) => living.includes(p));
  const next = order.find((p) => !passed.includes(p));
  if (!next) return endStep(state, deps);
  return emitted([{ t: 'PriorityGranted', player: next, stackSize: state.stack.length }]);
}

function endStep(state: GameState, deps: EngineDeps): Emitted {
  const events: EventBody[] = [{ t: 'StepEnded', phase: state.turn.phase, step: state.turn.step }];

  // CR 500.4 — mana pools empty at the end of every step and every phase.
  for (const id of state.seating) {
    const p = state.players[id];
    if (!p || poolTotal(p.pool) === 0) continue;
    events.push({ t: 'ManaPoolEmptied', player: id, lost: p.pool });
  }

  if (state.turn.step === 'endCombat' && state.combat) {
    const inCombat = creaturesInCombat(state);
    if (inCombat.length > 0) events.push({ t: 'RemovedFromCombat', cards: inCombat });
    events.push({ t: 'CombatEnded' });
  }

  if (state.turn.step === 'cleanup') {
    // CR 514.3a — repeat the cleanup step if anything happened during it.
    if (state.turn.cleanupNeedsRepeat) {
      events.push({ t: 'CleanupRepeatSet', value: false });
      events.push({ t: 'StepBegan', phase: 'ending', step: 'cleanup' });
      return emitted(events);
    }
    return emitted([...events, ...beginNextTurn(state)]);
  }

  const next = nextStep(state);
  if (!next) return emitted([...events, ...beginNextTurn(state)]);

  // Cleanup's own turn-based actions, emitted as the step begins, because there
  // is no priority round in which to do them.
  events.push({ t: 'StepBegan', phase: next.phase, step: next.step });
  if (next.step === 'cleanup') {
    const damaged = state.zones.battlefield.filter((id) => (state.cards[id]?.damage ?? 0) > 0);
    if (damaged.length > 0) events.push({ t: 'DamageCleared', cards: damaged });
    // CR 514.2 — "until end of turn" effects end here, in the same turn-based
    // action that wipes damage. A Giant Growth that outlived its turn would make
    // every subsequent combat wrong, quietly.
    if (state.untilEndOfTurn.length > 0) events.push({ t: 'UntilEndOfTurnEnded' });
  }
  void deps;
  return emitted(events);
}

function beginNextTurn(state: GameState): EventBody[] {
  const living = livingPlayers(state);
  if (living.length === 0) return [{ t: 'GameEnded', winners: [] }];
  const order = state.seating;
  const at = order.indexOf(state.turn.activePlayer);
  let nextPlayer = living[0] as PlayerId;
  for (let i = 1; i <= order.length; i++) {
    const candidate = order[(at + i) % order.length];
    if (candidate && living.includes(candidate)) {
      nextPlayer = candidate;
      break;
    }
  }
  return [
    { t: 'TurnBegan', turnNumber: state.turn.turnNumber + 1, activePlayer: nextPlayer },
    { t: 'StepBegan', phase: 'beginning', step: 'untap' },
  ];
}

// ── resolving the top of the stack ───────────────────────────────────────────

function resolveTop(state: GameState, deps: EngineDeps): Emitted {
  const obj = state.stack[state.stack.length - 1];
  if (!obj) return emitted([]);
  const events: EventBody[] = [];

  if (obj.card !== null) {
    const card = state.cards[obj.card];
    if (!card) return emitted([{ t: 'StackResolved', stackId: obj.id, card: null, to: null, targets: obj.targets }]);
    const oracleCard = deps.oracle.byPrinting(card.printingId);
    const face = oracleCard ? faceOf(oracleCard, card.faceIndex) : null;

    if (!targetsStillLegal(state, deps, obj, face)) {
      // CR 608.2b — a spell whose targets are all illegal is removed from the
      // stack and does nothing. It goes to the graveyard, not to exile.
      events.push({ t: 'SpellFizzled', stackId: obj.id });
      events.push({
        t: 'CardsMoved',
        moves: [{ card: obj.card, from: { kind: 'stack', player: null }, to: { kind: 'graveyard', player: card.owner } }],
      });
      events.push(
        narrated(`${obj.label} is countered on resolution — no legal targets.`, obj.controller, obj.identity),
      );
      return emitted(events);
    }

    const to = face?.isPermanent
      ? { kind: 'battlefield' as const, player: obj.controller }
      : { kind: 'graveyard' as const, player: card.owner };
    events.push({ t: 'StackResolved', stackId: obj.id, card: obj.card, to, targets: obj.targets });
    // ⚠️ THE EFFECT RUNS BEFORE THE CARD MOVES. A spell is still on the stack
    // while it resolves (CR 608.2), so its own text can point at the board it is
    // about to leave — and, concretely, a Bolt that had already been put into the
    // graveyard would have no source for its damage.
    //
    // ⚠️ Only `auto`. A partly-understood card does nothing here and is offered
    // to the player instead: half-executing is the one outcome worse than not
    // executing at all. See `effectParse.ts`.
    if (face && face.effectMode === 'auto' && face.effects.length > 0) {
      events.push(...effectEvents(state, deps, obj, face.effects));
    }
    events.push({
      t: 'CardsMoved',
      moves: [{ card: obj.card, from: { kind: 'stack', player: null }, to }],
    });
    events.push(narrated(`${obj.label} resolves.`, obj.controller, obj.identity));
    return emitted(events);
  }

  // An ability. With no card scripts there is nothing to run, but the object
  // still leaves the stack — which is what stops a triggered ability from
  // wedging the priority loop forever.
  events.push({ t: 'StackResolved', stackId: obj.id, card: null, to: null, targets: obj.targets });
  const script = obj.abilityRef ? deps.scripts.get(obj.abilityRef.slice(0, obj.abilityRef.indexOf('#'))) : undefined;
  const def = script?.triggers?.find((t) => `${script.oracleId}#${t.abilityId}` === obj.abilityRef);
  if (script && def && obj.source) {
    const cache = makeDeriveCache(state);
    events.push(
      ...def.resolve(
        {
          state,
          oracle: deps.oracle,
          derive: (id: InstanceId) => derive(state, deps.oracle, deps.scripts, id, cache),
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
        },
        obj.source,
        obj,
      ),
    );
  }
  events.push(narrated(`${obj.label} resolves.`, obj.controller, obj.identity));
  return emitted(events);
}

/**
 * CR 608.2b — a spell fizzles only when EVERY target is illegal. `.some()` is
 * therefore correct and a two-target spell that lost one still resolves.
 *
 * ⚠️ Now runs the SAME predicate declaration ran (`targetAllowed`), against the
 * spell's own parsed clauses. The old check looked only at the zone and admitted
 * graveyard and exile for everything — harmless while spells did nothing, and a
 * real bug the moment they did: a Bolt aimed at a creature that had been exiled
 * in response still resolved and marked damage on a card outside the
 * battlefield, which `checkInvariants` caught as "has damage outside the
 * battlefield". A target that changed zones is a NEW object (CR 400.7) and is
 * never still legal.
 */
function targetsStillLegal(state: GameState, deps: EngineDeps, obj: StackObject, face: OracleFace | null): boolean {
  if (obj.targets.length === 0) return true;
  const specs = face?.targets ?? [];
  const candidates = candidatesFromState(state, deps);
  const src = { controller: obj.controller, colors: face?.colors ?? [] };
  return obj.targets.some((target, i) => {
    const candidate = candidates.find(
      (c) => c.choice.kind === target.kind && c.choice.id === target.id,
    );
    if (!candidate) return false;
    const spec = specs[i];
    // No parsed clause (a free-aim card, or an ability) still gets the CR
    // restrictions — shroud and protection do not stop applying because the
    // parser could not read the sentence.
    return spec ? targetAllowed(spec, src, candidate) : !untargetableByRule(src, candidate);
  });
}

// ── the driver ───────────────────────────────────────────────────────────────

export interface PumpResult {
  readonly state: GameState;
  readonly log: readonly GameEvent[];
  readonly events: readonly GameEvent[];
}

/**
 * Run the engine until it blocks or finishes.
 *
 * ⚠️ `stepId` advances once per `advance()` call, so every event ONE unit of
 * engine work produced shares a group in the choreographer. That is the
 * difference between a table that reads as a sequence and one where everything
 * happens at once.
 *
 * ⚠️ Hitting MAX_ITER is a BUG, not a long game, and the throw carries the last
 * twenty events. The alternative — silently returning — is a hang with no
 * evidence, which is the single worst failure mode a loop like this can have.
 */
export function pump(
  state: GameState,
  log: readonly GameEvent[],
  deps: EngineDeps,
  onCommit: (state: GameState, log: readonly GameEvent[], batch: Emitted, stepId: number) => PumpResult,
): PumpResult {
  let current: PumpResult = { state, log, events: [] };
  const produced: GameEvent[] = [];
  for (let i = 0; i < MAX_ITER; i++) {
    const batch = advance(current.state, deps);
    if (batch.events.length === 0) {
      return { state: current.state, log: current.log, events: produced };
    }
    const stepId = current.state.stepId + 1;
    current = onCommit(current.state, current.log, batch, stepId);
    produced.push(...current.events);
  }
  const tail = produced.slice(-20).map((e) => e.body.t).join(', ');
  throw new Error(
    `pump: exceeded ${MAX_ITER} iterations — the engine is not converging. Last events: ${tail}`,
  );
}

/** Blocker damage from a specific blocker, exposed for the combat tests. */
export { assignBlockerDamage };

/** Whether a player currently has any legal action other than passing. */
export function hasAnyAction(state: GameState, deps: EngineDeps, player: PlayerId): boolean {
  return legalActions(state, deps.oracle, deps.scripts, player).some((a) => a.t !== 'PassPriority');
}

export { EMPTY_POOL };
