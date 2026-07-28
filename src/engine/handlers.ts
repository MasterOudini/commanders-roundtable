// `handle(state, intent, deps) → Event[] | Reject`. The only way a player
// changes the game.
//
// ⚠️ Every rejection message is written FROM THE PLAYER'S SIDE and says what to
// do next, because a rejection is the one place the engine talks to a human who
// has just been told "no". "notYourPriority" is a code for the client; "Ana has
// priority — wait for her to pass" is the message.

import {
  legalDefenders,
  needsFirstStrikeSubstep,
  canAttack,
  validateBlockDeclaration,
} from './combat';
import { derive, makeDeriveCache } from './derive';
import { canActAtSorcerySpeed } from './legal';
import { buildPaymentProblem, manaSourcesOf, wardTaxFrom } from './mana';
import { hybridCombinations, spendFromPool } from './mana';
import { faceOf } from './oracle';
import { suggestPayment, solveInputFor, validatePlan } from './payment';
import { manualIntent } from './manual';
import { flipCoin, rollDie, shuffle } from './rng';
import { n, narrated, their, vb, who } from './narrate';
import { bottomCountFor, drawFromTop } from './setup';
import type { EngineDeps } from './loop';
import type { CardMove, EventBody } from './types/events';
import type { AbilityRef, InstanceId, PlayerId, StackId, ZoneRef } from './types/ids';
import type { TargetSpec } from './types/oracle';
import { candidatesFromState, validateTargets } from './targets';
import { EMPTY_POOL, poolFrom, type ManaCost, type ManaPool, type ManaSymbolKey } from './types/mana';
import {
  accept,
  reject,
  type HandleResult,
  type Intent,
} from './types/intents';
import type { Awaiting, GameState, PendingCast, StackObject, TargetChoice } from './types/state';

const KEYS: readonly ManaSymbolKey[] = ['W', 'U', 'B', 'R', 'G', 'C'];

export function handle(state: GameState, intent: Intent, deps: EngineDeps): HandleResult {
  if (state.gamePhase === 'finished') {
    return reject('gameOver', 'The game is over. Start a new one to keep playing.');
  }
  switch (intent.t) {
    case 'StartGame':
      return reject('gameNotStarted', 'The game is already being set up.');
    case 'MulliganDecision':
      return mulliganDecision(state, intent, deps);
    case 'MulliganBottom':
      return mulliganBottom(state, intent);
    case 'PassPriority':
      return passPriority(state, intent.player, false);
    case 'PassForPlayer':
      return passForPlayer(state, intent);
    case 'HoldPriority':
      return holdPriority(intent);
    case 'SetStops':
      return accept([{ t: 'StopsChanged', player: intent.player, stops: intent.stops }]);
    case 'PlayLand':
      return playLand(state, intent, deps);
    case 'CastSpell':
      return castSpell(state, intent, deps);
    case 'ChooseX':
      return chooseX(state, intent, deps);
    case 'ActivateAbility':
      return activateAbility(state, intent, deps);
    case 'ChooseTargets':
      return chooseTargets(state, intent, deps);
    case 'PayCast':
      return payCast(state, intent, deps);
    case 'CancelPendingCast':
      return cancelPendingCast(state, intent.player);
    case 'TapForMana':
      return tapForMana(state, intent, deps);
    case 'DeclareAttackers':
      return declareAttackers(state, intent, deps);
    case 'DeclareBlockers':
      return declareBlockers(state, intent, deps);
    case 'OrderBlockers':
      return orderBlockers(state, intent);
    case 'OrderAttackers':
      return orderAttackers(state, intent);
    case 'ChooseLegendKeep':
      return chooseLegendKeep(state, intent);
    case 'CommanderZoneChoice':
      return commanderZoneChoice(state, intent);
    case 'OrderTriggers':
      return orderTriggers(state, intent);
    case 'Concede':
      return concede(state, intent.player);
    case 'RollDice':
      return rollDice(state, intent);
    case 'FlipCoin':
      return doFlipCoin(state, intent);
    case 'ProposeRewind':
      return proposeRewind(state, intent);
    case 'VoteRewind':
      return voteRewind(state, intent);
    case 'CancelRewind':
      return cancelRewind(state, intent.player);
    default:
      return manualIntent(state, intent, deps);
  }
}

// ── mulligan ─────────────────────────────────────────────────────────────────

function mulliganDecision(
  state: GameState,
  intent: Extract<Intent, { t: 'MulliganDecision' }>,
  deps: EngineDeps,
): HandleResult {
  void deps;
  const awaiting = state.priority.awaiting;
  if (state.gamePhase !== 'mulligan' || awaiting?.kind !== 'mulligan') {
    return reject('notAwaitingThat', 'Mulligans are over.');
  }
  const p = state.players[intent.player];
  if (!p) return reject('noSuchPlayer', 'That player is not in this game.');
  if (p.mulligan.kept) return reject('alreadySubmitted', 'You have already kept your hand.');

  if (intent.keep) {
    const toBottom = bottomCountFor(state, intent.player);
    const events: EventBody[] = [{ t: 'MulliganKept', player: intent.player, toBottom }];
    events.push(
      narrated(
        toBottom === 0
          ? n`${who(state, intent.player)} ${vb(intent.player, 'keeps', 'keep')} ${state.zones.hand[intent.player]?.length ?? 0}.`
          : n`${who(state, intent.player)} ${vb(intent.player, 'keeps', 'keep')} and ${vb(intent.player, 'puts', 'put')} ${toBottom} on the bottom.`,
        intent.player,
      ),
    );
    if (toBottom > 0) {
      events.push({
        t: 'AwaitingSet',
        awaiting: { kind: 'mulliganBottom', player: intent.player, count: toBottom },
      });
    }
    return accept(events);
  }

  // London mulligan: shuffle the whole hand back, draw a fresh seven, and pay
  // for it later by bottoming — NOT by drawing fewer.
  const hand = state.zones.hand[intent.player] ?? [];
  const library = state.zones.library[intent.player] ?? [];
  const events: EventBody[] = [];
  if (hand.length > 0) {
    events.push({
      t: 'CardsMoved',
      moves: hand.map((card) => ({
        card,
        from: { kind: 'hand' as const, player: intent.player },
        to: { kind: 'library' as const, player: intent.player },
      })),
    });
  }
  const combined = [...library, ...hand];
  const shuffled = shuffle(state.rng, combined);
  events.push({ t: 'LibraryShuffled', player: intent.player, order: shuffled.value });
  events.push(...drawFromTop(intent.player, state.options.startingHandSize, shuffled.value));
  events.push({ t: 'MulliganTaken', player: intent.player, taken: p.mulligan.taken + 1 });
  const free = state.options.freeFirstMulligan && p.mulligan.taken === 0;
  events.push(
    narrated(
      n`${who(state, intent.player)} ${vb(intent.player, 'mulligans', 'mulligan')}${free ? ' (free)' : ` to ${Math.max(0, state.options.startingHandSize - bottomCountForAfter(state, p.mulligan.taken + 1))}`}.`,
      intent.player,
    ),
  );
  events.push({ t: 'AwaitingSet', awaiting: null });
  return accept(events, shuffled.next);
}

function bottomCountForAfter(state: GameState, taken: number): number {
  return Math.max(0, taken - (state.options.freeFirstMulligan ? 1 : 0));
}

function mulliganBottom(
  state: GameState,
  intent: Extract<Intent, { t: 'MulliganBottom' }>,
): HandleResult {
  const awaiting = state.priority.awaiting;
  if (awaiting?.kind !== 'mulliganBottom' || awaiting.player !== intent.player) {
    return reject('notAwaitingThat', 'You do not have cards to put on the bottom.');
  }
  if (intent.cards.length !== awaiting.count) {
    return reject('invalidAmount', `Choose exactly ${awaiting.count} card${awaiting.count === 1 ? '' : 's'} to put on the bottom.`);
  }
  const hand = state.zones.hand[intent.player] ?? [];
  for (const card of intent.cards) {
    if (!hand.includes(card)) return reject('wrongZone', 'That card is not in your hand.');
  }
  return accept([
    {
      t: 'CardsMoved',
      moves: intent.cards.map((card) => ({
        card,
        from: { kind: 'hand' as const, player: intent.player },
        to: { kind: 'library' as const, player: intent.player },
        placement: 'bottom' as const,
      })),
    },
    { t: 'MulliganBottomed', player: intent.player, cards: intent.cards },
    { t: 'AwaitingSet', awaiting: null },
  ]);
}

// ── priority ─────────────────────────────────────────────────────────────────

function passPriority(state: GameState, player: PlayerId, forced: boolean): HandleResult {
  if (state.priority.awaiting !== null) {
    return reject('notYourPriority', 'The game is waiting on a choice first.');
  }
  if (state.priority.player !== player) {
    const holder = state.priority.player;
    return reject(
      'notYourPriority',
      holder ? `${state.players[holder]?.name ?? holder} has priority — wait for them to pass.` : 'You do not have priority.',
    );
  }
  return accept([{ t: 'PriorityPassed', player, auto: false, forced }]);
}

function passForPlayer(
  state: GameState,
  intent: Extract<Intent, { t: 'PassForPlayer' }>,
): HandleResult {
  const target = state.players[intent.target];
  if (!target) return reject('noSuchPlayer', 'That player is not in this game.');
  if (target.connected) {
    return reject('playerConnected', `${target.name} is connected — let them take their turn.`);
  }
  const result = passPriority(state, intent.target, true);
  if (!result.ok) return result;
  return accept([
    ...result.events,
    narrated(
      // ⚠️ TWO different players in one sentence, and the verb agrees with the
      // SUBJECT (whoever clicked) while the colour belongs to the disconnected
      // seat. This is the line `vb`'s explicit player argument exists for.
      n`${who(state, intent.player)} passed for ${who(state, intent.target)}, who is disconnected.`,
      // The line is ABOUT the disconnected player, not about whoever clicked.
      intent.target,
      [],
      true,
    ),
  ]);
}

function holdPriority(intent: Extract<Intent, { t: 'HoldPriority' }>): HandleResult {
  return accept([{ t: 'HoldPrioritySet', player: intent.hold ? intent.player : null }]);
}

/** Every action that is not a pass re-grants priority to the actor (CR 117.3c). */
function retainPriority(player: PlayerId, stackSize: number): EventBody[] {
  return [
    { t: 'PriorityReset' },
    { t: 'PriorityGranted', player, stackSize },
  ];
}

// ── lands and spells ─────────────────────────────────────────────────────────

function playLand(
  state: GameState,
  intent: Extract<Intent, { t: 'PlayLand' }>,
  deps: EngineDeps,
): HandleResult {
  const p = state.players[intent.player];
  const card = state.cards[intent.card];
  if (!p) return reject('noSuchPlayer', 'That player is not in this game.');
  if (!card) return reject('noSuchCard', 'That card is not in the game.');
  if (!canActAtSorcerySpeed(state, intent.player)) {
    return reject('timingRestriction', 'You can only play a land in your own main phase with an empty stack.');
  }
  if (card.zone.kind !== 'hand' || card.zone.player !== intent.player) {
    return reject('wrongZone', 'That card is not in your hand.');
  }
  if (p.landsPlayedThisTurn >= p.maxLandsPerTurn) {
    return reject('landDropUsed', `You have already played ${p.maxLandsPerTurn} land this turn.`);
  }
  const oracleCard = deps.oracle.byPrinting(card.printingId);
  if (!oracleCard) return reject('noSuchCard', 'That card is not in the card database.');
  const face = faceOf(oracleCard, 0);
  if (!face.isLand) return reject('notALand', `${face.name} is not a land.`);

  return accept([
    {
      t: 'CardsMoved',
      moves: [
        {
          card: intent.card,
          from: { kind: 'hand', player: intent.player },
          to: { kind: 'battlefield', player: intent.player },
        },
      ],
    },
    { t: 'LandPlayed', player: intent.player, card: intent.card, playedThisTurn: p.landsPlayedThisTurn + 1 },
    narrated(
      n`${who(state, intent.player)} ${vb(intent.player, 'plays', 'play')} ${face.name}.`,
      intent.player,
      oracleCard.colorIdentity,
    ),
    ...retainPriority(intent.player, state.stack.length),
  ]);
}

interface CastSetup {
  readonly problem: ReturnType<typeof buildPaymentProblem>;
  readonly face: ReturnType<typeof faceOf>;
  readonly tax: number;
  readonly from: ZoneRef;
  readonly identity: readonly import('../data/cardTypes').ColorLetter[];
}

/**
 * Ward, charged as a CAST-TIME TAX. CR 702.21a, simplified deliberately.
 *
 * ⚠️ M5 (D68). Ward has been in the Tier-2 table since M1 and in D44/Q4 as
 * "ward as a cast-time tax", `parseWard` has produced a `wardCost` since M3 —
 * and NOTHING read it. The keyword was documented as enforced and was not
 * enforced anywhere, which is worse than an honest gap: a player reads the tier
 * table, believes the app is charging ward, and never checks.
 *
 * The real rule is a triggered ability that counters the spell unless the
 * controller pays. Charging it up front instead is the spec's own
 * simplification, and it is the right one here: the alternative needs a trigger
 * that can counter a spell already on the stack plus a second payment prompt
 * mid-resolution, and the observable outcome — you pay, or you do not cast — is
 * the same at a friends-only table.
 *
 * ⚠️ Only OPPONENTS' permanents ward. Targeting your own warded creature is
 * free, and charging yourself for it would be a rules bug players would feel
 * immediately.
 */
function wardTaxFor(
  state: GameState,
  deps: EngineDeps,
  player: PlayerId,
  targets: readonly TargetChoice[],
): { mana: ManaCost[]; life: number } {
  const faces = [];
  for (const target of targets) {
    if (target.kind !== 'card') continue;
    const card = state.cards[target.id];
    if (!card || card.zone.kind !== 'battlefield') continue;
    if (card.controller === player) continue;
    const oracleCard = deps.oracle.byPrinting(card.printingId);
    if (!oracleCard) continue;
    faces.push(faceOf(oracleCard, card.faceIndex));
  }
  // ⚠️ The SUM is shared with the client (D53). Only the lookup above differs.
  return wardTaxFrom(faces);
}

function prepareCast(
  state: GameState,
  deps: EngineDeps,
  player: PlayerId,
  cardId: InstanceId,
  faceIndex: number,
  xValue: number,
  targets: readonly TargetChoice[] = [],
): CastSetup | { error: HandleResult } {
  const card = state.cards[cardId];
  if (!card) return { error: reject('noSuchCard', 'That card is not in the game.') };
  const oracleCard = deps.oracle.byPrinting(card.printingId);
  if (!oracleCard) return { error: reject('noSuchCard', 'That card is not in the card database.') };
  const face = faceOf(oracleCard, faceIndex);
  if (face.manaCost === null || face.isLand) {
    return { error: reject('notCastable', `${face.name} cannot be cast.`) };
  }
  const from: ZoneRef = { kind: card.zone.kind, player: card.zone.player };
  if (from.kind !== 'hand' && from.kind !== 'command') {
    return { error: reject('wrongZone', `${face.name} is not somewhere you can cast it from.`) };
  }
  if (from.player !== player) return { error: reject('wrongZone', 'That is not your card.') };
  if (from.kind === 'command' && !card.isCommander) {
    return { error: reject('notCastable', 'Only a commander can be cast from the command zone.') };
  }
  if (!face.instantSpeed && !canActAtSorcerySpeed(state, player)) {
    return {
      error: reject(
        'timingRestriction',
        `${face.name} is sorcery-speed — cast it in your own main phase with an empty stack.`,
      ),
    };
  }
  if (state.priority.player !== player) {
    return { error: reject('notYourPriority', 'You do not have priority.') };
  }
  const tax = from.kind === 'command' && card.isCommander ? 2 * card.commanderCastCount : 0;
  const ward = wardTaxFor(state, deps, player, targets);
  const problem = buildPaymentProblem(face.manaCost, xValue, ward.mana, tax, ward.life);
  return { problem, face, tax, from, identity: oracleCard.colorIdentity };
}

function castSpell(
  state: GameState,
  intent: Extract<Intent, { t: 'CastSpell' }>,
  deps: EngineDeps,
): HandleResult {
  if (state.pendingCast) {
    return reject('wrongCastStage', 'Finish or cancel the spell you are already casting.');
  }
  const faceIndex = 0;
  const setup = prepareCast(
    state,
    deps,
    intent.player,
    intent.card,
    faceIndex,
    intent.xValue ?? 0,
    intent.targets ?? [],
  );
  if ('error' in setup) return setup.error;

  // ⚠️ ORDER IS CR 601.2b THEN 601.2c: X is announced before targets are chosen.
  // It matters — ~172 cards read `X target creatures`, where the number of
  // targets IS X, and asking for targets first makes those cards unaskable.
  // `PendingCast` lives in GAME STATE, which is what makes "Bob dropped while
  // choosing" recoverable rather than fatal.
  const needsX = !!setup.face.manaCost && setup.face.manaCost.xCount > 0 && intent.xValue === undefined;
  const needsTargets = setup.face.targets.length > 0 && intent.targets === undefined;

  if (needsX || needsTargets) {
    const stackId = `s${state.counters.stack + 1}`;
    const pending: PendingCast = {
      player: intent.player,
      card: intent.card,
      from: setup.from,
      stackId,
      stage: needsX ? 'x' : 'targets',
      kind: 'spell',
      abilityRef: null,
      modes: [],
      targets: intent.targets ?? [],
      xValue: intent.xValue ?? null,
      problem: setup.problem,
      paidSoFar: EMPTY_POOL,
      lifePaid: 0,
      isCommanderCast: setup.from.kind === 'command',
      taxApplied: setup.tax,
    };
    return accept([
      {
        t: 'CardsMoved',
        moves: [{ card: intent.card, from: setup.from, to: { kind: 'stack', player: null } }],
      },
      { t: 'CastBegan', pending },
      // ⚠️ A STAGE THAT STOPS MUST SAY SO. Without this the X stage halted
      // invisibly: `advance()` fell through to `priority()`, the caster could
      // auto-pass, and the card was stranded in the stack zone with a live
      // `pendingCast` and no `StackObject` — which `checkInvariants` cannot see,
      // because it skips stack-zone cards.
      {
        t: 'AwaitingSet',
        awaiting: needsX
          ? { kind: 'chooseX', player: intent.player, stackId, source: intent.card, label: setup.face.name }
          : targetsAwaiting(intent.player, stackId, intent.card, setup.face.name, setup.face.targets, 'spell'),
      },
    ]);
  }

  return completeCast(state, deps, {
    player: intent.player,
    card: intent.card,
    faceIndex,
    xValue: intent.xValue ?? 0,
    targets: intent.targets ?? [],
    ...(intent.plan !== undefined ? { plan: intent.plan } : {}),
    setup,
  });
}

function chooseX(
  state: GameState,
  intent: Extract<Intent, { t: 'ChooseX' }>,
  deps: EngineDeps,
): HandleResult {
  const pending = state.pendingCast;
  if (!pending || pending.player !== intent.player) {
    return reject('noPendingCast', 'You are not casting anything.');
  }
  if (pending.stage !== 'x') return reject('wrongCastStage', 'That spell does not need a value for X.');
  if (!Number.isInteger(intent.x) || intent.x < 0) {
    return reject('invalidAmount', 'X must be zero or more.');
  }
  const card = state.cards[pending.card];
  const oracleCard = card ? deps.oracle.byPrinting(card.printingId) : undefined;
  if (!card || !oracleCard) return reject('noSuchCard', 'That card is not in the game.');
  const face = faceOf(oracleCard, card.faceIndex);
  const problem = buildPaymentProblem(face.manaCost, intent.x, [], pending.taxApplied);

  // CR 601.2c follows 601.2b: with X known, ask for the targets it may size.
  if (face.targets.length > 0 && pending.targets.length === 0) {
    return accept([
      { t: 'XChosen', x: intent.x, problem },
      { t: 'CastStageSet', stage: 'targets' },
      {
        t: 'AwaitingSet',
        awaiting: targetsAwaiting(
          intent.player,
          pending.stackId,
          pending.card,
          face.name,
          face.targets,
          'spell',
        ),
      },
    ]);
  }

  // The card is already on the stack, so finish the cast from there.
  return finishFromPending(state, deps, { ...pending, xValue: intent.x, problem }, face, oracleCard.colorIdentity);
}

/**
 * Activating a non-mana ability of a permanent you control.
 *
 * ⚠️ THE SOURCE CARD DOES NOT MOVE. Unlike a cast there is no `CardsMoved` on the
 * way in and none to compensate on cancel — get that wrong and you either delete
 * a permanent or duplicate it, and `checkInvariants` will not catch it because it
 * skips stack-zone cards.
 */
function activateAbility(
  state: GameState,
  intent: Extract<Intent, { t: 'ActivateAbility' }>,
  deps: EngineDeps,
): HandleResult {
  if (state.pendingCast) {
    return reject('wrongCastStage', 'Finish or cancel the spell you are already casting.');
  }
  if (state.priority.player !== intent.player) {
    return reject('notYourPriority', 'You do not have priority.');
  }
  const card = state.cards[intent.card];
  if (!card) return reject('noSuchCard', 'That card is not in the game.');
  if (card.controller !== intent.player) return reject('wrongZone', 'That is not your permanent.');
  const oracleCard = deps.oracle.byPrinting(card.printingId);
  if (!oracleCard) return reject('noSuchCard', 'That card is not in the card database.');
  const face = faceOf(oracleCard, card.faceIndex);
  const ability = face.activated[intent.abilityIndex];
  if (!ability) return reject('notCastable', 'That permanent has no such ability.');
  if (ability.isManaAbility) {
    return reject('notAManaAbility', 'That is a mana ability — tap it for mana instead.');
  }
  if (!ability.payable) {
    return reject('notCastable', `${face.name}'s "${ability.costText}" cost is not one the app can pay — use the manual tools.`);
  }
  if (ability.requiresTap && card.tapped) return reject('alreadyTapped', `${face.name} is already tapped.`);
  if (ability.requiresUntap && !card.tapped) return reject('notUntapped', `${face.name} must be tapped for that.`);
  if (ability.sorceryOnly && !canActAtSorcerySpeed(state, intent.player)) {
    return reject('timingRestriction', `${face.name}'s ability is sorcery-speed — use it in your own main phase with an empty stack.`);
  }

  const stackId = `s${state.counters.stack + 1}`;
  const abilityRef = `${oracleCard.oracleId}#a${intent.abilityIndex}`;
  const problem = buildPaymentProblem(ability.manaCost, 0, [], 0, ability.lifeCost);
  const needsTargets = ability.targets.length > 0 && intent.targets === undefined;

  const pending: PendingCast = {
    player: intent.player,
    card: intent.card,
    // ⚠️ Records where the permanent IS, and is never used to move it — an
    // ability leaves its source on the battlefield.
    from: { kind: 'battlefield', player: intent.player },
    stackId,
    stage: needsTargets ? 'targets' : 'pay',
    kind: 'ability',
    abilityRef,
    modes: [],
    targets: intent.targets ?? [],
    xValue: null,
    problem,
    paidSoFar: EMPTY_POOL,
    lifePaid: 0,
    isCommanderCast: false,
    taxApplied: 0,
  };

  if (needsTargets) {
    return accept([
      { t: 'CastBegan', pending },
      {
        t: 'AwaitingSet',
        awaiting: targetsAwaiting(
          intent.player,
          stackId,
          intent.card,
          `${face.name} — ${ability.costText}: ${ability.effectText}`,
          ability.targets,
          'ability',
        ),
      },
    ]);
  }

  return finishAbility(state, deps, pending, face, ability, oracleCard.colorIdentity, intent.plan);
}

/** The prompt payload. Everything a reconnecting client needs to rebuild it. */
function targetsAwaiting(
  player: PlayerId,
  stackId: StackId,
  source: InstanceId,
  label: string,
  specs: readonly TargetSpec[],
  forKind: 'spell' | 'ability',
): Extract<Awaiting, { kind: 'chooseTargets' }> {
  return {
    kind: 'chooseTargets',
    player,
    stackId,
    count: specs.reduce((n, s) => n + s.min, 0),
    source,
    label,
    specs,
    forKind,
  };
}

function chooseTargets(
  state: GameState,
  intent: Extract<Intent, { t: 'ChooseTargets' }>,
  deps: EngineDeps,
): HandleResult {
  const pending = state.pendingCast;
  if (!pending || pending.player !== intent.player) {
    return reject('noPendingCast', 'You are not casting anything.');
  }
  // ⚠️ The stage check `chooseX` has always had and this has always lacked.
  if (pending.stage !== 'targets') {
    return reject('wrongCastStage', 'That spell is not waiting for targets.');
  }
  const card = state.cards[pending.card];
  const oracleCard = card ? deps.oracle.byPrinting(card.printingId) : undefined;
  if (!card || !oracleCard) return reject('noSuchCard', 'That card is not in the game.');
  const face = faceOf(oracleCard, card.faceIndex);
  const specs = pending.kind === 'ability'
    ? face.activated[abilityIndexOf(pending.abilityRef)]?.targets ?? []
    : face.targets;

  const src = { controller: intent.player, colors: face.colors };
  const verdict = validateTargets(
    specs,
    src,
    face.name,
    intent.targets,
    candidatesFromState(state, deps),
  );
  // The reject reason declared in M3 and unused until now.
  if (!verdict.ok) return reject('illegalTarget', verdict.message);

  if (pending.kind === 'ability') {
    const ability = face.activated[abilityIndexOf(pending.abilityRef)];
    if (!ability) return reject('notCastable', 'That permanent has no such ability.');
    // Ward applies to an ability's targets too (CR 702.21a).
    const wardA = wardTaxFor(state, deps, intent.player, intent.targets);
    const problemA = buildPaymentProblem(ability.manaCost, 0, wardA.mana, 0, ability.lifeCost + wardA.life);
    return finishAbility(
      state,
      deps,
      { ...pending, targets: intent.targets, problem: problemA, stage: 'pay' },
      face,
      ability,
      oracleCard.colorIdentity,
      undefined,
      [{ t: 'TargetsChosen', targets: intent.targets, problem: problemA }],
    );
  }

  // ⚠️ CR 601.2c BEFORE 601.2f — the targets are what PRICE the ward surcharge,
  // so the payment problem is rebuilt here. This is the first time in the app's
  // life `wardTaxFor` can return anything but zero, because until targeting
  // existed nothing ever supplied it a target.
  const ward = wardTaxFor(state, deps, intent.player, intent.targets);
  const problem = buildPaymentProblem(
    face.manaCost,
    pending.xValue ?? 0,
    ward.mana,
    pending.taxApplied,
    ward.life,
  );

  return finishFromPending(
    state,
    deps,
    { ...pending, targets: intent.targets, problem, stage: 'pay' },
    face,
    oracleCard.colorIdentity,
    {
      lead: [{ t: 'TargetsChosen', targets: intent.targets, problem }],
      // `chooseX` logged it already when this cast had an X stage.
      xAlreadyLogged: pending.xValue !== null,
    },
  );
}

/** `oracleId#aN` → N. Abilities are addressed by index within their face. */
function abilityIndexOf(ref: AbilityRef | null): number {
  if (!ref) return -1;
  const hash = ref.indexOf('#a');
  return hash < 0 ? -1 : Number(ref.slice(hash + 2));
}

function payCast(
  state: GameState,
  intent: Extract<Intent, { t: 'PayCast' }>,
  deps: EngineDeps,
): HandleResult {
  const pending = state.pendingCast;
  if (!pending || pending.player !== intent.player) {
    return reject('noPendingCast', 'You are not casting anything.');
  }
  const card = state.cards[pending.card];
  const oracleCard = card ? deps.oracle.byPrinting(card.printingId) : undefined;
  if (!card || !oracleCard) return reject('noSuchCard', 'That card is not in the game.');
  const face = faceOf(oracleCard, card.faceIndex);
  return finishFromPending(state, deps, pending, face, oracleCard.colorIdentity, { plan: intent.plan });
}

function cancelPendingCast(state: GameState, player: PlayerId): HandleResult {
  const pending = state.pendingCast;
  if (!pending || pending.player !== player) {
    return reject('noPendingCast', 'You are not casting anything.');
  }
  // ⚠️ COMPENSATING events, not a truncated log. The log stays append-only,
  // which is the property reconnect, replay and rewind all rest on.
  //
  // ⚠️ AN ABILITY HAS NOTHING TO MOVE BACK. Its source never left the
  // battlefield, so emitting the cast path's `CardsMoved` here would teleport a
  // permanent out of the stack zone it was never in — and because
  // `checkInvariants` skips stack-zone cards, nothing downstream would notice.
  const events: EventBody[] = [];
  if (pending.kind === 'spell') {
    events.push({
      t: 'CardsMoved',
      moves: [{ card: pending.card, from: { kind: 'stack', player: null }, to: pending.from }],
    });
  }
  events.push({ t: 'CastCancelled', stackId: pending.stackId });
  // Backing out also dismisses whatever the cast was asking for.
  events.push({ t: 'AwaitingSet', awaiting: null });
  return accept(events);
}

interface CompleteArgs {
  player: PlayerId;
  card: InstanceId;
  faceIndex: number;
  xValue: number;
  targets: readonly import('./types/state').TargetChoice[];
  plan?: import('./types/mana').PaymentPlan;
  setup: CastSetup;
}

function completeCast(state: GameState, deps: EngineDeps, args: CompleteArgs): HandleResult {
  const { setup } = args;
  const solve = solveInputFor(state, deps.oracle, deps.scripts, args.player);
  const plan = args.plan ?? suggestPayment(solve, setup.problem);
  if (!plan) {
    return reject(
      'cannotAfford',
      `You cannot pay ${setup.face.manaCost?.raw ?? ''}${setup.tax > 0 ? ` plus {${setup.tax}} commander tax` : ''} for ${setup.face.name}.`,
    );
  }
  const problem = validatePlan(state, deps.oracle, deps.scripts, args.player, setup.problem, plan);
  if (problem === 'stale') {
    return reject('stalePaymentPlan', 'The board changed while you were paying. Try again.');
  }
  if (problem === 'invalid') {
    return reject('invalidPaymentPlan', 'That payment does not cover the cost.');
  }

  const stackId = `s${state.counters.stack + 1}`;
  const events: EventBody[] = [
    {
      t: 'CardsMoved',
      moves: [{ card: args.card, from: setup.from, to: { kind: 'stack', player: null } }],
    },
  ];
  events.push(...payEvents(state, deps, args.player, plan, setup));

  const card = state.cards[args.card];
  const obj: StackObject = {
    id: stackId,
    kind: 'spell',
    controller: args.player,
    card: args.card,
    source: null,
    abilityRef: null,
    targets: args.targets,
    modes: [],
    xValue: args.xValue > 0 ? args.xValue : null,
    label: setup.face.name,
    identity: setup.identity,
    taxApplied: setup.tax,
    isCommanderCast: setup.from.kind === 'command',
    castFrom: setup.from,
  };
  events.push({ t: 'SpellCast', obj });
  if (setup.from.kind === 'command' && card?.isCommander) {
    events.push({
      t: 'CommanderCastCountIncreased',
      card: args.card,
      to: card.commanderCastCount + 1,
    });
  }
  events.push(
    narrated(
      n`${who(state, args.player)} ${vb(args.player, 'casts', 'cast')} ${setup.face.name}${setup.tax > 0 ? ` (commander tax {${setup.tax}})` : ''}.`,
      args.player,
      setup.identity,
    ),
  );
  events.push(...retainPriority(args.player, state.stack.length + 1));
  return accept(events);
}

/**
 * Pay for an ability and put it on the stack.
 *
 * ⚠️ Deliberately its own function rather than a branch inside
 * `finishFromPending`. The two differ in every step that touches a card: no
 * `CardsMoved`, `AbilityPutOnStack` instead of `SpellCast`, `card: null` with
 * `source` set, and the tap paid in the SAME batch (CR 602.2b — costs are paid on
 * activation, not on resolution). Threading four booleans through the cast path
 * to express that would make both harder to read and neither safer.
 */
function finishAbility(
  state: GameState,
  deps: EngineDeps,
  pending: PendingCast,
  face: ReturnType<typeof faceOf>,
  ability: ReturnType<typeof faceOf>['activated'][number],
  identity: readonly import('../data/cardTypes').ColorLetter[],
  plan?: import('./types/mana').PaymentPlan,
  lead: readonly EventBody[] = [],
): HandleResult {
  const solve = solveInputFor(state, deps.oracle, deps.scripts, pending.player);
  const chosen = plan ?? suggestPayment(solve, pending.problem);
  if (!chosen) return reject('cannotAfford', `You cannot pay ${ability.costText} for ${face.name}.`);
  const problem = validatePlan(state, deps.oracle, deps.scripts, pending.player, pending.problem, chosen);
  if (problem === 'stale') return reject('stalePaymentPlan', 'The board changed while you were paying. Try again.');
  if (problem === 'invalid') return reject('invalidPaymentPlan', 'That payment does not cover the cost.');

  const events: EventBody[] = [...lead];
  events.push({ t: 'AwaitingSet', awaiting: null });
  events.push(
    ...payEvents(state, deps, pending.player, chosen, {
      problem: pending.problem,
      face,
      tax: 0,
      from: pending.from,
      identity,
    }),
  );
  // CR 602.2b — the tap is part of the COST, so it is paid now, in this batch.
  if (ability.requiresTap) events.push({ t: 'PermanentsTapped', cards: [pending.card] });
  if (ability.requiresUntap) events.push({ t: 'PermanentsUntapped', cards: [pending.card] });

  const obj: StackObject = {
    id: pending.stackId,
    kind: 'activated',
    controller: pending.player,
    // ⚠️ `card: null` is what makes this a chit rather than a card on the stack,
    // and `resolveTop` already keys off it — an ability resolving must not move
    // the permanent it came from.
    card: null,
    source: pending.card,
    abilityRef: pending.abilityRef,
    targets: pending.targets,
    modes: [],
    xValue: null,
    label: `${face.name} — ${ability.effectText}`,
    identity,
    taxApplied: 0,
    isCommanderCast: false,
    castFrom: null,
  };
  events.push({ t: 'AbilityPutOnStack', obj });
  events.push(
    narrated(
      n`${who(state, pending.player)} ${vb(pending.player, 'activates', 'activate')} ${face.name}'s ability.`,
      pending.player,
      identity,
    ),
  );
  events.push(...retainPriority(pending.player, state.stack.length + 1));
  return accept(events);
}

interface FinishOpts {
  readonly plan?: import('./types/mana').PaymentPlan;
  /** Events that belong before the payment, e.g. `TargetsChosen`. */
  readonly lead?: readonly EventBody[];
  /** True when an earlier stage already logged `XChosen`, so it is not re-logged. */
  readonly xAlreadyLogged?: boolean;
}

function finishFromPending(
  state: GameState,
  deps: EngineDeps,
  pending: PendingCast,
  face: ReturnType<typeof faceOf>,
  identity: readonly import('../data/cardTypes').ColorLetter[],
  opts: FinishOpts = {},
): HandleResult {
  const plan = opts.plan;
  const solve = solveInputFor(state, deps.oracle, deps.scripts, pending.player);
  const chosen = plan ?? suggestPayment(solve, pending.problem);
  if (!chosen) {
    return reject('cannotAfford', `You cannot pay for ${face.name} with X = ${pending.xValue ?? 0}.`);
  }
  const problem = validatePlan(state, deps.oracle, deps.scripts, pending.player, pending.problem, chosen);
  if (problem === 'stale') return reject('stalePaymentPlan', 'The board changed while you were paying. Try again.');
  if (problem === 'invalid') return reject('invalidPaymentPlan', 'That payment does not cover the cost.');

  const setup: CastSetup = {
    problem: pending.problem,
    face,
    tax: pending.taxApplied,
    from: pending.from,
    identity,
  };
  const events: EventBody[] = [...(opts.lead ?? [])];
  // ⚠️ THE CAST IS NO LONGER WAITING ON ANYONE, so say so. Every handler that
  // answers a prompt clears it, and this is the single funnel where a staged
  // cast completes. Leaving it set was measurable and ugly: the fuzzer showed
  // 6,070 target prompts against 37 declarations, because after the first
  // successful cast `pendingCast` was gone while the prompt stayed up, so every
  // subsequent answer came back "You are not casting anything."
  events.push({ t: 'AwaitingSet', awaiting: null });
  if (pending.xValue !== null && !opts.xAlreadyLogged) {
    events.push({ t: 'XChosen', x: pending.xValue, problem: pending.problem });
  }
  events.push(...payEvents(state, deps, pending.player, chosen, setup));

  const card = state.cards[pending.card];
  const obj: StackObject = {
    id: pending.stackId,
    kind: 'spell',
    controller: pending.player,
    card: pending.card,
    source: null,
    abilityRef: null,
    targets: pending.targets,
    modes: pending.modes,
    xValue: pending.xValue,
    label: face.name,
    identity,
    taxApplied: pending.taxApplied,
    isCommanderCast: pending.isCommanderCast,
    castFrom: pending.from,
  };
  events.push({ t: 'SpellCast', obj });
  if (pending.isCommanderCast && card?.isCommander) {
    events.push({ t: 'CommanderCastCountIncreased', card: pending.card, to: card.commanderCastCount + 1 });
  }
  events.push(
    narrated(
      n`${who(state, pending.player)} ${vb(pending.player, 'casts', 'cast')} ${face.name}${pending.xValue ? ` with X = ${pending.xValue}` : ''}.`,
      pending.player,
      identity,
    ),
  );
  events.push(...retainPriority(pending.player, state.stack.length + 1));
  return accept(events);
}

/** Taps, mana added, mana spent, life paid — CR 601.2g/h, each its own event. */
function payEvents(
  state: GameState,
  deps: EngineDeps,
  player: PlayerId,
  plan: import('./types/mana').PaymentPlan,
  setup: CastSetup,
): EventBody[] {
  const events: EventBody[] = [];
  const sources = manaSourcesOf(state, deps.oracle, deps.scripts, player, { includeConditional: true });
  const produced: Record<ManaSymbolKey, number> = { W: 0, U: 0, B: 0, R: 0, G: 0, C: 0 };
  const tapped: InstanceId[] = [];

  for (const tap of plan.taps) {
    const source = sources.find((s) => s.card === tap.source && s.abilityIndex === tap.abilityIndex);
    const output = source?.outputs[tap.outputChoice];
    if (!source || !output) continue;
    if (source.requiresTap && !tapped.includes(tap.source)) tapped.push(tap.source);
    for (const k of KEYS) produced[k] += output.mana[k];
    events.push({ t: 'ManaAdded', player, mana: output.mana, source: tap.source });
  }
  if (tapped.length > 0) events.push({ t: 'PermanentsTapped', cards: tapped });

  const concrete = hybridCombinations(setup.problem).find(
    (c) =>
      c.hybridChoices.length === plan.hybridChoices.length &&
      c.hybridChoices.every((h, i) => plan.hybridChoices[i]?.option === h.option),
  );
  const pool = state.players[player]?.pool ?? EMPTY_POOL;
  const total: Record<ManaSymbolKey, number> = { ...produced };
  for (const k of KEYS) total[k] += pool[k];
  const spend = concrete ? spendFromPool(total as ManaPool, concrete) : null;
  if (spend) events.push({ t: 'ManaSpent', player, mana: spend });
  if (plan.lifePaid > 0) {
    const life = state.players[player]?.life ?? 0;
    events.push({ t: 'LifeChanged', player, delta: -plan.lifePaid, to: life - plan.lifePaid });
  }
  return events;
}

function tapForMana(
  state: GameState,
  intent: Extract<Intent, { t: 'TapForMana' }>,
  deps: EngineDeps,
): HandleResult {
  if (state.priority.player !== intent.player && state.pendingCast?.player !== intent.player) {
    return reject('notYourPriority', 'You can only tap for mana while you have priority.');
  }
  const sources = manaSourcesOf(state, deps.oracle, deps.scripts, intent.player, {
    includeConditional: true,
  });
  const source = sources.find(
    (s) => s.card === intent.card && s.abilityIndex === intent.abilityIndex,
  );
  if (!source) return reject('notAManaAbility', 'That permanent cannot make mana right now.');
  const output = source.outputs[intent.outputChoice];
  if (!output) return reject('notAManaAbility', 'That is not one of its mana options.');
  const card = state.cards[intent.card];
  if (source.requiresTap && card?.tapped) return reject('alreadyTapped', 'That permanent is already tapped.');

  const events: EventBody[] = [];
  if (source.requiresTap) events.push({ t: 'PermanentsTapped', cards: [intent.card] });
  events.push({ t: 'ManaAdded', player: intent.player, mana: output.mana, source: intent.card });
  return accept(events);
}

// ── combat ───────────────────────────────────────────────────────────────────

function declareAttackers(
  state: GameState,
  intent: Extract<Intent, { t: 'DeclareAttackers' }>,
  deps: EngineDeps,
): HandleResult {
  const awaiting = state.priority.awaiting;
  if (awaiting?.kind !== 'declareAttackers' || awaiting.player !== intent.player) {
    return reject('notAwaitingThat', 'It is not your declare-attackers step.');
  }
  const cache = makeDeriveCache(state);
  const cdeps = { state, oracle: deps.oracle, scripts: deps.scripts, cache };
  const defenders = legalDefenders(cdeps, intent.player);
  const seen = new Set<InstanceId>();
  for (const a of intent.attackers) {
    if (seen.has(a.card)) return reject('illegalAttacker', 'That creature is already attacking.');
    seen.add(a.card);
    if (!canAttack(cdeps, a.card)) {
      const name = derive(state, deps.oracle, deps.scripts, a.card, cache).name || 'That creature';
      return reject('illegalAttacker', `${name} cannot attack right now.`);
    }
    const ok = defenders.some((dref) => dref.kind === a.defender.kind && dref.id === a.defender.id);
    if (!ok) return reject('illegalAttacker', 'That is not a legal thing to attack.');
  }

  const events: EventBody[] = [
    { t: 'AttackersDeclared', attackers: intent.attackers },
    { t: 'AwaitingSet', awaiting: null },
  ];
  // CR 508.1f — attacking taps the creature unless it has vigilance.
  const toTap = intent.attackers
    .map((a) => a.card)
    .filter((id) => !derive(state, deps.oracle, deps.scripts, id, cache).keywords.has('vigilance'));
  if (toTap.length > 0) events.push({ t: 'PermanentsTapped', cards: toTap });
  events.push(
    narrated(
      intent.attackers.length === 0
        ? n`${who(state, intent.player)} ${vb(intent.player, 'attacks', 'attack')} with nothing.`
        : n`${who(state, intent.player)} ${vb(intent.player, 'attacks', 'attack')} with ${intent.attackers.length} creature${intent.attackers.length === 1 ? '' : 's'}.`,
      intent.player,
    ),
  );
  events.push({ t: 'TurnBasedActionsDone' });
  return accept(events);
}

function declareBlockers(
  state: GameState,
  intent: Extract<Intent, { t: 'DeclareBlockers' }>,
  deps: EngineDeps,
): HandleResult {
  const awaiting = state.priority.awaiting;
  if (awaiting?.kind !== 'declareBlockers' || !awaiting.players.includes(intent.player)) {
    return reject('notAwaitingThat', 'You are not declaring blockers.');
  }
  if (awaiting.submitted.includes(intent.player)) {
    return reject('alreadySubmitted', 'You have already declared your blocks.');
  }
  const cache = makeDeriveCache(state);
  const cdeps = { state, oracle: deps.oracle, scripts: deps.scripts, cache };
  for (const b of intent.blocks) {
    if (state.cards[b.blocker]?.controller !== intent.player) {
      return reject('illegalBlock', 'That is not your creature.');
    }
  }

  const submitted = [...awaiting.submitted, intent.player];
  const everyone = submitted.length === awaiting.players.length;
  const existing = state.combat
    ? state.combat.blockers.flatMap((b) => b.attackerOrder.map((a) => ({ blocker: b.card, attacker: a })))
    : [];
  const all = [...existing, ...intent.blocks];

  // ⚠️ Validated over the WHOLE declaration, not per pair: menace is "blocked by
  // 0 or ≥2 creatures", which a per-block API physically cannot express.
  const check = validateBlockDeclaration(cdeps, all);
  if (!check.ok) return reject(check.reason, check.detail);

  const events: EventBody[] = [{ t: 'BlockersDeclared', blocks: all }];
  if (!everyone) {
    events.push({
      t: 'AwaitingSet',
      // ⚠️ The legal matrix is carried FORWARD unchanged. It was computed against
      // the board when blockers were first asked for, and nothing between one
      // player submitting and the next can legally change it — declaring blocks
      // is a single turn-based action with no priority in the middle.
      awaiting: { kind: 'declareBlockers', players: awaiting.players, submitted, legal: awaiting.legal },
    });
    return accept(events);
  }

  const blockedAttackers = [...new Set(all.map((b) => b.attacker))];
  if (blockedAttackers.length > 0) {
    events.push({ t: 'AttackerBecameBlocked', attackers: blockedAttackers });
  }
  events.push({ t: 'AwaitingSet', awaiting: null });
  events.push({
    t: 'FirstStrikeSubstepDecided',
    needed: needsFirstStrikeSubstep({ state, oracle: deps.oracle, scripts: deps.scripts, cache }),
  });
  events.push(
    narrated(
      all.length === 0 ? 'No blocks.' : `${all.length} block${all.length === 1 ? '' : 's'} declared.`,
      // Blocks are declared by everyone being attacked at once, so this one
      // genuinely belongs to no single seat.
      null,
    ),
  );
  events.push({ t: 'TurnBasedActionsDone' });
  return accept(events);
}

function orderBlockers(
  state: GameState,
  intent: Extract<Intent, { t: 'OrderBlockers' }>,
): HandleResult {
  const decl = state.combat?.attackers.find((a) => a.card === intent.attacker);
  if (!decl) return reject('notAwaitingThat', 'That creature is not attacking.');
  if (!sameSet(decl.blockerOrder, intent.order)) {
    return reject('invalidOrder', 'That ordering does not list exactly the creatures blocking it.');
  }
  return accept([{ t: 'BlockerOrderSet', attacker: intent.attacker, order: intent.order }]);
}

function orderAttackers(
  state: GameState,
  intent: Extract<Intent, { t: 'OrderAttackers' }>,
): HandleResult {
  const decl = state.combat?.blockers.find((b) => b.card === intent.blocker);
  if (!decl) return reject('notAwaitingThat', 'That creature is not blocking.');
  if (!sameSet(decl.attackerOrder, intent.order)) {
    return reject('invalidOrder', 'That ordering does not list exactly the creatures it is blocking.');
  }
  return accept([{ t: 'AttackerOrderSet', blocker: intent.blocker, order: intent.order }]);
}

function sameSet(a: readonly string[], b: readonly string[]): boolean {
  if (a.length !== b.length) return false;
  const sa = [...a].sort();
  const sb = [...b].sort();
  return sa.every((x, i) => sb[i] === x);
}

// ── prompts ──────────────────────────────────────────────────────────────────

function chooseLegendKeep(
  state: GameState,
  intent: Extract<Intent, { t: 'ChooseLegendKeep' }>,
): HandleResult {
  const awaiting = state.priority.awaiting;
  if (awaiting?.kind !== 'chooseLegendKeep' || awaiting.player !== intent.player) {
    return reject('notAwaitingThat', 'You are not choosing a legend to keep.');
  }
  if (!awaiting.candidates.includes(intent.keep)) {
    return reject('noSuchCard', 'That is not one of the copies you control.');
  }
  const doomed = awaiting.candidates.filter((id) => id !== intent.keep);
  const moves: CardMove[] = doomed.map((card) => ({
    card,
    from: { kind: 'battlefield' as const, player: intent.player },
    to: { kind: 'graveyard' as const, player: state.cards[card]?.owner ?? intent.player },
  }));
  return accept([
    { t: 'CardsMoved', moves },
    narrated(`Legend rule: ${awaiting.name} — ${doomed.length} put into the graveyard.`, intent.player),
    { t: 'AwaitingSet', awaiting: null },
  ]);
}

function commanderZoneChoice(
  state: GameState,
  intent: Extract<Intent, { t: 'CommanderZoneChoice' }>,
): HandleResult {
  const awaiting = state.priority.awaiting;
  if (awaiting?.kind !== 'commanderZoneChoice' || awaiting.player !== intent.player) {
    return reject('notAwaitingThat', 'You are not being asked about a commander.');
  }
  const head = awaiting.queue[0];
  if (!head) return accept([{ t: 'AwaitingSet', awaiting: null }]);
  const events: EventBody[] = [];
  if (intent.toCommandZone) {
    events.push({
      t: 'CardsMoved',
      moves: [{ card: head.card, from: head.from, to: { kind: 'command', player: head.player } }],
    });
    events.push(
      narrated(
        n`${who(state, head.player)} ${vb(head.player, 'returns', 'return')} ${their(head.player)} commander to the command zone.`,
        head.player,
      ),
    );
  }
  if (intent.always) {
    events.push({ t: 'CommanderZoneAlwaysSet', player: intent.player, value: intent.toCommandZone });
  }
  const rest = awaiting.queue.slice(1);
  const next = rest[0];
  events.push({
    t: 'AwaitingSet',
    awaiting: next ? { kind: 'commanderZoneChoice', player: next.player, queue: rest } : null,
  });
  return accept(events);
}

function orderTriggers(
  state: GameState,
  intent: Extract<Intent, { t: 'OrderTriggers' }>,
): HandleResult {
  const awaiting = state.priority.awaiting;
  if (awaiting?.kind !== 'orderTriggers' || awaiting.player !== intent.player) {
    return reject('notAwaitingThat', 'You are not ordering triggers.');
  }
  if (!sameSet(awaiting.triggers, intent.order)) {
    return reject('invalidOrder', 'That ordering does not list exactly your waiting triggers.');
  }
  const byId = new Map(state.pendingTriggers.map((t) => [t.id, t]));
  const reordered = [
    ...intent.order.map((id) => byId.get(id)).filter((t): t is NonNullable<typeof t> => !!t),
    ...state.pendingTriggers.filter((t) => !intent.order.includes(t.id)),
  ];
  return accept([
    { t: 'PendingTriggersCleared', ids: state.pendingTriggers.map((t) => t.id) },
    { t: 'PendingTriggersAdded', triggers: reordered },
    { t: 'AwaitingSet', awaiting: null },
  ]);
}

function concede(state: GameState, player: PlayerId): HandleResult {
  const p = state.players[player];
  if (!p) return reject('noSuchPlayer', 'That player is not in this game.');
  if (p.hasLost) return reject('playerHasLost', 'You are already out of the game.');
  return accept([
    { t: 'PlayerLost', player, reason: 'conceded' },
    narrated(n`${who(state, player)} ${vb(player, 'concedes', 'concede')}.`, player),
  ]);
}

// ── dice, coins ──────────────────────────────────────────────────────────────

function rollDice(state: GameState, intent: Extract<Intent, { t: 'RollDice' }>): HandleResult {
  if (!Number.isInteger(intent.sides) || intent.sides < 2 || intent.sides > 1000) {
    return reject('invalidAmount', 'Choose a die with between 2 and 1000 sides.');
  }
  const roll = rollDie(state.rng, intent.sides);
  return accept(
    [
      { t: 'DiceRolled', player: intent.player, sides: intent.sides, result: roll.value },
      narrated(
        n`${who(state, intent.player)} ${vb(intent.player, 'rolls', 'roll')} a d${intent.sides}: ${roll.value}.`,
        intent.player,
        [],
        true,
      ),
    ],
    roll.next,
  );
}

function doFlipCoin(state: GameState, intent: Extract<Intent, { t: 'FlipCoin' }>): HandleResult {
  const flip = flipCoin(state.rng);
  return accept(
    [
      { t: 'CoinFlipped', player: intent.player, heads: flip.value },
      narrated(
        n`${who(state, intent.player)} ${vb(intent.player, 'flips', 'flip')} ${flip.value ? 'heads' : 'tails'}.`,
        intent.player,
        [],
        true,
      ),
    ],
    flip.next,
  );
}

// ── rewind (D9) ──────────────────────────────────────────────────────────────

function proposeRewind(
  state: GameState,
  intent: Extract<Intent, { t: 'ProposeRewind' }>,
): HandleResult {
  if (intent.toEventCount < 1 || intent.toEventCount > state.eventCount) {
    return reject('rewindOutOfRange', 'That is not a point in this game you can go back to.');
  }
  if (state.priority.awaiting?.kind === 'rewindVote') {
    return reject('noRewindPending', 'A rewind is already being voted on.');
  }
  return accept([
    { t: 'RewindProposed', proposer: intent.player, toEventCount: intent.toEventCount },
    {
      t: 'AwaitingSet',
      awaiting: {
        kind: 'rewindVote',
        proposer: intent.player,
        toEventCount: intent.toEventCount,
        agreed: [intent.player],
        declined: [],
      },
    },
    narrated(
      n`${who(state, intent.player)} ${vb(intent.player, 'proposes', 'propose')} rewinding to event ${intent.toEventCount}.`,
      intent.player,
      [],
      true,
    ),
  ]);
}

function voteRewind(state: GameState, intent: Extract<Intent, { t: 'VoteRewind' }>): HandleResult {
  const awaiting = state.priority.awaiting;
  if (awaiting?.kind !== 'rewindVote') return reject('noRewindPending', 'Nobody has proposed a rewind.');
  if (awaiting.agreed.includes(intent.player) || awaiting.declined.includes(intent.player)) {
    return reject('alreadySubmitted', 'You have already voted.');
  }
  const agreed = intent.agree ? [...awaiting.agreed, intent.player] : awaiting.agreed;
  const declined = intent.agree ? awaiting.declined : [...awaiting.declined, intent.player];
  const living = state.seating.filter((id) => !(state.players[id]?.hasLost ?? true));

  if (declined.length > 0) {
    return accept([
      { t: 'RewindVoted', player: intent.player, agree: false },
      { t: 'RewindCancelled' },
      { t: 'AwaitingSet', awaiting: null },
      narrated(
        // Past tense — one form for both persons, so no verb part.
        n`${who(state, intent.player)} declined the rewind.`,
        intent.player,
        [],
        true,
      ),
    ]);
  }
  if (living.every((id) => agreed.includes(id))) {
    // ⚠️ The actual rewind is NOT a reducer case. It re-folds a PREFIX of the
    // log into a fresh state — see `Game.rewind` — because a reducer that could
    // move backwards would break the append-only invariant everything rests on.
    return accept([
      { t: 'RewindVoted', player: intent.player, agree: true },
      { t: 'AwaitingSet', awaiting: null },
    ]);
  }
  return accept([
    { t: 'RewindVoted', player: intent.player, agree: true },
    {
      t: 'AwaitingSet',
      awaiting: { kind: 'rewindVote', proposer: awaiting.proposer, toEventCount: awaiting.toEventCount, agreed, declined },
    },
  ]);
}

function cancelRewind(state: GameState, player: PlayerId): HandleResult {
  if (state.priority.awaiting?.kind !== 'rewindVote') {
    return reject('noRewindPending', 'Nobody has proposed a rewind.');
  }
  return accept([
    { t: 'RewindCancelled' },
    { t: 'AwaitingSet', awaiting: null },
    narrated(n`${who(state, player)} cancelled the rewind.`, player, [], true),
  ]);
}

export { manualIntent, poolFrom };
