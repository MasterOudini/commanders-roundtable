// `handle(state, intent, deps) → Event[] | Reject`. The only way a player
// changes the game.
//
// ⚠️ Every rejection message is written FROM THE PLAYER'S SIDE and says what to
// do next, because a rejection is the one place the engine talks to a human who
// has just been told "no". "notYourPriority" is a code for the client; "Ana has
// priority — wait for her to pass" is the message.

import { replacementOptions, resumeReplacementFunnel } from './triggers';
import {
  legalDefenders,
  needsFirstStrikeSubstep,
  canAttack,
  validateBlockDeclaration,
} from './combat';
import { derive, makeDeriveCache } from './derive';
import { activatedDefRegistered, canActAtSorcerySpeed, castableFaces } from './legal';
import { buildPaymentProblem, costStringOf, manaSourcesOf, wardTaxFrom } from './mana';
import { hybridCombinations, spendFromPool } from './mana';
import { faceOf } from './oracle';
import { suggestPayment, solveInputFor, validatePlan } from './payment';
import { manualIntent } from './manual';
import { flipCoin, rollDie, shuffle } from './rng';
import { n, narrated, their, vb, who } from './narrate';
import { bottomCountFor, drawFromTop } from './setup';
import { resolveAbility, stackPendingTriggers, type EngineDeps } from './loop';
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
      return orderTriggers(state, intent, deps);
    case 'AnswerOptionalTrigger':
      return answerOptionalTrigger(state, intent, deps);
    case 'AnswerChooseReplacement':
      return answerChooseReplacement(state, intent, deps);
    case 'AnswerChooseColor':
      return answerChooseColor(state, intent);
    case 'AnswerEntersChoice':
      return answerEntersChoice(state, intent);
    case 'AnswerChooseFromZone':
      return answerChooseFromZone(state, intent);
    case 'AnswerOrderCards':
      return answerOrderCards(state, intent);
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
  // ⚠️ CR 712 — the land half of a modal DFC. This read `faceOf(oracleCard, 0)`
  // until D155, so `Malakir Mire` came down as `Malakir Rebirth` and failed
  // `notALand`, while `legalActions` had been offering it since M3.
  const faceIndex = intent.faceIndex ?? 0;
  if (!castableFaces(oracleCard).includes(faceIndex)) {
    return reject('noSuchCard', `${oracleCard.name} has no face ${faceIndex} you can play.`);
  }
  const face = faceOf(oracleCard, faceIndex);
  if (!face.isLand) return reject('notALand', `${face.name} is not a land.`);

  return accept([
    {
      t: 'CardsMoved',
      moves: [
        {
          card: intent.card,
          from: { kind: 'hand', player: intent.player },
          to: { kind: 'battlefield', player: intent.player },
          // ⚠️ ON THE MOVE, so the replacement funnel — which reads the state
          // BEFORE this event — can see that `Malakir Mire` enters tapped and
          // that `Agadeem, the Undercrypt` asks for 3 life. See D155.
          ...(faceIndex === 0 ? {} : { faceIndex }),
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
  // ⚠️ CR 712 — WHICH FACE. This was `const faceIndex = 0` until D155, so a
  // modal DFC's back face was offered by `legalActions`, clickable in the UI,
  // and cast as the FRONT face. `castableFaces` is the same function the offer
  // is built from, asked again here because the host decides legality (D139).
  const faceIndex = intent.faceIndex ?? 0;
  const printing = deps.oracle.byPrinting(state.cards[intent.card]?.printingId ?? '');
  if (printing && !castableFaces(printing).includes(faceIndex)) {
    return reject('noSuchCard', `${printing.name} has no face ${faceIndex} you can cast.`);
  }
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

  /**
   * ⚠️ **INLINE TARGETS WERE NEVER CHECKED, AND THE HOST IS THE ONLY AUTHORITY**
   * (found while building D139). `prepareCast` takes the list and uses it for one
   * thing — the ward surcharge — so a `CastSpell` that NAMED its targets skipped
   * `validateTargets` altogether. The two-stage path validates in
   * `chooseTargets`; this one had no equivalent.
   *
   * ⚠️ It is not reachable from this app's own UI, which always lets the targets
   * stage raise its prompt (`intent.targets` is undefined there) — but "the host
   * decides legality" is the property the whole net layer rests on, and a rule
   * enforced only when the client asks nicely is not enforced. It is also exactly
   * the seam a test driver uses, which is how a suite can go green on casts no
   * player could make.
   */
  if (intent.targets !== undefined && setup.face.targets.length > 0) {
    const verdict = validateTargets(
      setup.face.targets,
      { controller: intent.player, colors: setup.face.colors },
      setup.face.name,
      intent.targets,
      candidatesFromState(state, deps),
    );
    if (!verdict.ok) return reject('illegalTarget', verdict.message);
  }

  if (needsX || needsTargets) {
    const stackId = `s${state.counters.stack + 1}`;
    const pending: PendingCast = {
      player: intent.player,
      card: intent.card,
      from: setup.from,
      stackId,
      stage: needsX ? 'x' : 'targets',
      kind: 'spell',
      faceIndex,
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
        // ⚠️ The face goes ONTO THE STACK with the card, so the object there IS
        // the back face: `resolveTop` reads `card.faceIndex` to decide whether
        // the spell is a permanent, and without this `Sword of the Realms`
        // would resolve straight into the graveyard. See D155.
        moves: [
          {
            card: intent.card,
            from: setup.from,
            to: { kind: 'stack', player: null },
            ...(faceIndex === 0 ? {} : { faceIndex }),
          },
        ],
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
  // ⚠️ The same rule `legal.ts` offers by (D159): a self-sacrifice is charged
  // only for an ability the registry will RUN. The host re-checks because a
  // client's word is not a rule (D139's shape) — without this, a hand-built
  // intent could eat a permanent for no effect.
  if (ability.sacrificesSelf && !activatedDefRegistered(deps.scripts, oracleCard.oracleId, intent.abilityIndex)) {
    return reject('notCastable', `${face.name}'s "${ability.costText}" cost is not one the app can pay — use the manual tools.`);
  }
  if (ability.requiresTap && card.tapped) return reject('alreadyTapped', `${face.name} is already tapped.`);
  if (ability.requiresUntap && !card.tapped) return reject('notUntapped', `${face.name} must be tapped for that.`);
  if (ability.sorceryOnly && !canActAtSorcerySpeed(state, intent.player)) {
    return reject('timingRestriction', `${face.name}'s ability is sorcery-speed — use it in your own main phase with an empty stack.`);
  }

  // ⚠️ D139's HOLE, ONE INTENT OVER (D161): a cast that NAMED its own targets
  // was validated since D139; an activation that named them went straight to
  // payment — so a hand-built intent could aim "target attacking creature" at
  // a bystander. Not reachable from this app's UI (the aim flow answers the
  // prompt stage, which has always validated), but "the host decides legality"
  // is what the whole net layer rests on, and the test driver uses exactly
  // this seam. Same predicate, same message as the prompt stage.
  if (intent.targets !== undefined && ability.targets.length > 0) {
    const verdict = validateTargets(
      ability.targets,
      { controller: intent.player, colors: face.colors },
      face.name,
      intent.targets,
      candidatesFromState(state, deps),
    );
    if (!verdict.ok) return reject('illegalTarget', verdict.message);
  }

  const stackId = `s${state.counters.stack + 1}`;
  const abilityRef = `${oracleCard.oracleId}#a${intent.abilityIndex}`;
  // War Room's computed cost: the RULE was parsed, the NUMBER is read off the
  // player now (D159) — and it rides in the problem, so the targets stage, the
  // payment review and the wire all see the real price.
  const lifeToPay =
    ability.lifeCost +
    (ability.lifeCostCommanderColors ? (state.players[intent.player]?.identity.length ?? 0) : 0);
  const problem = buildPaymentProblem(ability.manaCost, 0, [], 0, lifeToPay);
  const needsTargets = ability.targets.length > 0 && intent.targets === undefined;

  const pending: PendingCast = {
    player: intent.player,
    card: intent.card,
    // An ability is a chit, not a card on the stack. See D155.
    faceIndex: 0,
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

/**
 * Targets for a triggered ability that is already on the stack (CR 603.3d).
 *
 * ⚠️ **THE PROMPT VOUCHES FOR NOTHING.** `specs` crosses the wire, so a client
 * could send anything back; this is where the price is paid, exactly as
 * `answerChooseFromZone` does for a hidden zone. The source is the PERMANENT
 * whose ability triggered, so its colours are what ward and protection are
 * measured against.
 */
function chooseTriggerTargets(
  state: GameState,
  intent: Extract<Intent, { t: 'ChooseTargets' }>,
  deps: EngineDeps,
  awaiting: Extract<Awaiting, { kind: 'chooseTargets' }>,
): HandleResult {
  if (awaiting.player !== intent.player) {
    return reject('notYourTurn', 'That ability is not yours to aim.');
  }
  const source = state.cards[awaiting.source];
  const printing = source ? deps.oracle.byPrinting(source.printingId) : undefined;
  if (!source || !printing) return reject('noSuchCard', 'That card is not in the game.');
  const face = faceOf(printing, source.faceIndex);

  const verdict = validateTargets(
    awaiting.specs,
    { controller: intent.player, colors: face.colors },
    awaiting.label,
    intent.targets,
    candidatesFromState(state, deps),
  );
  if (!verdict.ok) return reject('illegalTarget', verdict.message);

  return {
    ok: true,
    events: [
      { t: 'StackTargetsSet', stackId: awaiting.stackId, targets: intent.targets },
      { t: 'AwaitingSet', awaiting: null },
    ],
  };
}

function chooseTargets(
  state: GameState,
  intent: Extract<Intent, { t: 'ChooseTargets' }>,
  deps: EngineDeps,
): HandleResult {
  // ⚠️ A TRIGGER FIRST, because it is the one shape with NO `pendingCast` — its
  // object is already on the stack (CR 603.3d). Reading `pendingCast` first
  // would reject every targeted trigger with "You are not casting anything",
  // which is true and useless.
  const awaiting = state.priority.awaiting;
  if (awaiting?.kind === 'chooseTargets' && awaiting.forKind === 'trigger') {
    return chooseTriggerTargets(state, intent, deps, awaiting);
  }

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
      moves: [
        {
          card: args.card,
          from: setup.from,
          to: { kind: 'stack', player: null },
          ...(args.faceIndex === 0 ? {} : { faceIndex: args.faceIndex }),
        },
      ],
    },
  ];
  events.push(...payEvents(state, deps, args.player, plan, setup));

  const card = state.cards[args.card];
  const obj: StackObject = {
    id: stackId,
    kind: 'spell',
    faceIndex: args.faceIndex,
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
  // ⚠️ THE SELF-SACRIFICE IS A COST TOO (CR 602.2b, D159) — paid here, before
  // the ability is on the stack, so the source is already in its owner's
  // graveyard when anything can respond. The move goes through the ordinary
  // event so dies-triggers (Onulet's shape) and the funnel see it like any
  // other death; `resolve` must therefore never assume its source is still on
  // the battlefield. Reachable only past `legal.ts`'s and `activateAbility`'s
  // def gates, so it can never eat a permanent for a scriptless ability.
  if (ability.sacrificesSelf) {
    const src = state.cards[pending.card];
    if (!src) return reject('noSuchCard', 'That permanent is not in the game.');
    events.push({
      t: 'CardsMoved',
      moves: [
        {
          card: pending.card,
          from: { kind: 'battlefield', player: pending.player },
          to: { kind: 'graveyard', player: src.owner },
        },
      ],
    });
    events.push(
      narrated(
        n`${who(state, pending.player)} ${vb(pending.player, 'sacrifices', 'sacrifice')} ${face.name}.`,
        pending.player,
        identity,
      ),
    );
  }

  const obj: StackObject = {
    id: pending.stackId,
    kind: 'activated',
    // An ability is a chit, not a card. See D155.
    faceIndex: 0,
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
    faceIndex: pending.faceIndex,
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

  // ⚠️ THE LOG SAID NOTHING ABOUT THIS UNTIL NOW, and it was the loudest silence
  // in the app: tapping a land emitted a tap and a pool change and no narration,
  // so a land that tapped correctly and a click that did nothing at all looked
  // identical. That is what made D116's partner-identity bug so hard to see from
  // the table — the Tower was tapping, for the one colour it had been told
  // about, in silence.
  //
  // ⚠️ Tier 1, so `manual: false` — no wrench. This is the engine performing a
  // rules action, not a player hand-waving one, and the log's whole job is to
  // keep those apart.
  //
  // ⚠️ It names the MANA, because "you tapped a land" is not the question a
  // player scans the log for; "where did that {U} come from" is.
  const name = derive(state, deps.oracle, deps.scripts, intent.card).name || 'a permanent';
  const added = costStringOf(output.mana);
  events.push(
    narrated(
      source.requiresTap
        ? n`${who(state, intent.player)} ${vb(intent.player, 'taps', 'tap')} ${name} for ${added}.`
        : n`${who(state, intent.player)} ${vb(intent.player, 'adds', 'add')} ${added} from ${name}.`,
      intent.player,
      [],
      false,
    ),
  );
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
  deps: EngineDeps,
): HandleResult {
  const awaiting = state.priority.awaiting;
  if (awaiting?.kind !== 'orderTriggers' || awaiting.player !== intent.player) {
    return reject('notAwaitingThat', 'You are not ordering triggers.');
  }
  if (!sameSet(awaiting.triggers, intent.order)) {
    return reject('invalidOrder', 'That ordering does not list exactly your waiting triggers.');
  }
  const byId = new Map(state.pendingTriggers.map((t) => [t.id, t]));
  const chosen = intent.order
    .map((id) => byId.get(id))
    .filter((t): t is NonNullable<typeof t> => !!t);
  // ⚠️ THE ANSWER PUTS THEM ON THE STACK, not merely into a new order. The
  // previous shape only reordered `pendingTriggers` — so the next drain saw the
  // same two-or-more group and asked again, forever: the answered half of
  // D158's livelock, on a prompt no test had ever reached through the live
  // loop. `stackPendingTriggers` is the drain's OWN stacking — one
  // implementation, two callers (D148's rule).
  //
  // ⚠️ `AwaitingSet null` FIRST: the stacking can raise a `chooseTargets`
  // prompt of its own, and clearing the awaiting afterwards would wipe it
  // (answerOptionalTrigger's lesson, two functions down).
  //
  // Triggers belonging to OTHER controllers stay pending — the next `advance()`
  // stacks or asks them in APNAP turn.
  return accept([
    { t: 'AwaitingSet', awaiting: null },
    ...stackPendingTriggers(state, deps, chosen).events,
  ]);
}

/**
 * CR 603.1 — the answer to a "may" trigger, which finishes a resolution
 * `resolveTop` deliberately stopped half way through.
 *
 * ⚠️ THE RESOLUTION IS `loop.ts`'s, NOT A COPY. `resolveAbility` is the single
 * implementation both callers share; re-implementing "leaves the stack, runs its
 * script, narrates" here is how the two would come to disagree about the order
 * of those three, which matters on any card that kills its own source.
 *
 * ⚠️ `AwaitingSet null` GOES FIRST, and that is not cosmetic: the resolution
 * runs through `applyReplacements`, which can raise a prompt of its own (a
 * commander heading for a graveyard), and clearing the awaiting afterwards would
 * wipe it.
 */
function answerOptionalTrigger(
  state: GameState,
  intent: Extract<Intent, { t: 'AnswerOptionalTrigger' }>,
  deps: EngineDeps,
): HandleResult {
  const awaiting = state.priority.awaiting;
  if (awaiting?.kind !== 'optionalTrigger' || awaiting.player !== intent.player) {
    return reject('notAwaitingThat', 'You are not being asked about an optional trigger.');
  }
  // ⚠️ The prompt names the stack object, and so must the answer. Without this
  // an answer aimed at a trigger that has already resolved would silently
  // resolve whatever is on top now — the shape D120 records for the assisted
  // offer, one zone along.
  if (awaiting.stackId !== intent.stackId) {
    return reject('notAwaitingThat', 'That is not the trigger you are being asked about.');
  }
  const obj = state.stack[state.stack.length - 1];
  if (!obj || obj.id !== awaiting.stackId) {
    return reject('noSuchCard', 'That trigger is no longer on top of the stack.');
  }
  return accept([
    { t: 'AwaitingSet', awaiting: null },
    { t: 'OptionalTriggerAnswered', stackId: obj.id, player: intent.player, accept: intent.accept },
    ...resolveAbility(state, deps, obj, intent.accept),
  ]);
}

/**
 * CR 614.12 — the answer to "as this enters, you may pay N life", which
 * `applyReplacements` asked as the permanent arrived. See D136.
 *
 * ⚠️ **THE PERMANENT IS ALREADY ON THE BATTLEFIELD, UNTAPPED, and this decides
 * whether it stays that way.** The alternative — suspending the fold until the
 * answer came back — means a continuation living in `GameState`, which is
 * hashable and replayable and enormous. Nobody can act in the gap, because an
 * `Awaiting` blocks every other intent.
 *
 * ⚠️ **THE LIFE IS RE-CHECKED HERE, not trusted from the prompt.** The prompt
 * was written when the permanent entered and the answer arrives later; between
 * them a state-based action or a replacement in the same batch can have taken
 * the player below the price. Paying life they no longer have would be a
 * negative life total conjured out of a stale number, so an unaffordable "yes"
 * is refused with a message rather than silently downgraded to "no" — the
 * player asked to pay, and being told why they cannot is the honest answer.
 *
 * ⚠️ **RE-ARMS FOR THE QUEUE**, exactly as `commanderZoneChoice` does: the tail
 * of the batch's questions becomes the next prompt, and only an empty tail
 * clears the awaiting.
 */
/**
 * CR 614.12 — the colour named as a permanent entered.
 *
 * ⚠️ The answer is a FACT the object keeps, not an action, so unlike every other
 * prompt here there is nothing to validate about the board: any of the five
 * colours is legal on any board. What IS validated is who is answering.
 */
/**
 * CR 616.1 — apply the chosen replacement, then keep folding.
 *
 * ⚠️ **THE ANSWER RESUMES A SUSPENDED FOLD**, which is unlike every other prompt
 * in this engine: the others answer a question and let the loop carry on, where
 * this one hands the engine back an event it has been holding unapplied. So the
 * events it returns are the REST OF THE ORIGINAL BATCH, and they must not go
 * through the funnel again — `resumeReplacementFunnel` has already done that,
 * and re-running the built-ins over them would add a planeswalker's loyalty
 * twice.
 */
function answerChooseReplacement(
  state: GameState,
  intent: Extract<Intent, { t: 'AnswerChooseReplacement' }>,
  deps: EngineDeps,
): HandleResult {
  const pending = state.pendingReplacement;
  const awaiting = state.priority.awaiting;
  if (!pending || awaiting?.kind !== 'chooseReplacement') {
    return reject('noPendingChoice', 'Nothing is waiting on a replacement effect.');
  }
  if (awaiting.player !== intent.player) {
    return reject('notYourTurn', 'That choice belongs to another player.');
  }
  if (!awaiting.options.some((o) => o.key === intent.key)) {
    return reject('illegalTarget', 'That is not one of the effects you were offered.');
  }

  const result = resumeReplacementFunnel(state, deps.oracle, deps.scripts, pending, intent.key);
  const chosen = awaiting.options.find((o) => o.key === intent.key);
  const said = narrated(
    n`${who(state, intent.player)} ${vb(intent.player, 'applies', 'apply')} ${chosen?.label ?? 'a replacement effect'} first.`,
    intent.player,
  );

  if (result.kind === 'done') {
    return {
      ok: true,
      funnelled: true,
      events: [
        { t: 'ReplacementResolved' },
        { t: 'AwaitingSet', awaiting: null },
        said,
        ...result.events,
      ],
    };
  }
  // ⚠️ It can stop again straight away — that is CR 616's "then repeat", and the
  // second question is a different one because the first answer changed which
  // effects still apply.
  return {
    ok: true,
    funnelled: true,
    events: [
      { t: 'ReplacementResolved' },
      said,
      ...result.settled,
      { t: 'ReplacementPending', pending: result.pending },
      { t: 'AwaitingSet', awaiting: { kind: 'chooseReplacement', player: result.pending.player, options: replacementOptions(state, deps.oracle, deps.scripts, result.pending) } },
    ],
  };
}

function answerChooseColor(
  state: GameState,
  intent: Extract<Intent, { t: 'AnswerChooseColor' }>,
): HandleResult {
  const awaiting = state.priority.awaiting;
  if (awaiting?.kind !== 'chooseColor') {
    return reject('noPendingChoice', 'Nothing is waiting for a colour.');
  }
  if (awaiting.player !== intent.player) {
    return reject('notYourTurn', 'That choice is not yours to make.');
  }
  return {
    ok: true,
    events: [
      { t: 'ColorChosen', card: awaiting.source, color: intent.color },
      narrated(
        n`${who(state, intent.player)} ${vb(intent.player, 'names', 'name')} {${intent.color}} for ${awaiting.label}.`,
        intent.player,
      ),
      { t: 'AwaitingSet', awaiting: null },
    ],
  };
}

function answerEntersChoice(
  state: GameState,
  intent: Extract<Intent, { t: 'AnswerEntersChoice' }>,
): HandleResult {
  const awaiting = state.priority.awaiting;
  if (awaiting?.kind !== 'entersChoice' || awaiting.player !== intent.player) {
    return reject('notAwaitingThat', 'You are not being asked about a permanent entering.');
  }
  // The prompt names the permanent, and so must the answer — an answer aimed at
  // one that has already been dealt with would otherwise pay for a different
  // card, which is the shape D128 guards on the stack id.
  if (awaiting.source !== intent.source) {
    return reject('notAwaitingThat', 'That is not the permanent you are being asked about.');
  }
  const seat = state.players[intent.player];
  if (intent.pay && (!seat || seat.life < awaiting.life)) {
    return reject('cannotAfford', `You do not have ${awaiting.life} life to pay.`);
  }

  const events: EventBody[] = [
    { t: 'EntersChoiceAnswered', card: awaiting.source, player: intent.player, pay: intent.pay },
  ];
  if (intent.pay) {
    const life = seat?.life ?? 0;
    events.push({ t: 'LifeChanged', player: intent.player, delta: -awaiting.life, to: life - awaiting.life });
    events.push(
      narrated(
        n`${who(state, intent.player)} ${vb(intent.player, 'pays', 'pay')} ${String(awaiting.life)} life for ${awaiting.label}.`,
        intent.player,
      ),
    );
  } else {
    events.push({ t: 'PermanentsTapped', cards: [awaiting.source] });
    events.push(
      narrated(n`${awaiting.label} enters tapped.`, intent.player),
    );
  }

  const next = awaiting.queue[0];
  events.push({
    t: 'AwaitingSet',
    awaiting: next
      ? {
          kind: 'entersChoice',
          player: next.player,
          source: next.card,
          life: next.life,
          label: next.label,
          queue: awaiting.queue.slice(1),
        }
      : null,
  });
  return accept(events);
}

/**
 * CR 701.8a — the cards a player picked out of their own hand to discard.
 *
 * ⚠️ **THE PROMPT SHIPS NO CANDIDATES, so this is the whole legality check.**
 * `Awaiting.chooseFromZone` says only who, which zone and how many — a hand is
 * hidden and listing it would post it to every client (D61). That is the right
 * trade, and the price is paid here: every id has to be checked against the
 * state rather than against a list the prompt vouched for.
 *
 * Four ways to get it wrong, and each is its own rejection:
 *   · the wrong number of cards — a short answer would discard too few
 *   · a DUPLICATE id — `[c1, c1]` looks like two cards and is one, so a `length`
 *     check alone would let a player discard half of what they owe
 *   · a card that is not in that zone — including one in somebody else's hand,
 *     which a client cannot see and so cannot have picked honestly
 *   · a card in the right zone belonging to the wrong player
 */
function answerChooseFromZone(
  state: GameState,
  intent: Extract<Intent, { t: 'AnswerChooseFromZone' }>,
): HandleResult {
  const awaiting = state.priority.awaiting;
  if (awaiting?.kind !== 'chooseFromZone' || awaiting.player !== intent.player) {
    return reject('notAwaitingThat', 'You are not being asked to choose cards.');
  }
  if (intent.cards.length !== awaiting.count) {
    return reject(
      'invalidAmount',
      `Choose exactly ${awaiting.count} card${awaiting.count === 1 ? '' : 's'}.`,
    );
  }
  const unique = new Set(intent.cards);
  if (unique.size !== intent.cards.length) {
    return reject('noSuchCard', 'You named the same card twice.');
  }
  /**
   * ⚠️ **THE LIBRARY CASE DERIVES "THE REST" FROM THE REVEAL** (D141), which is
   * why the prompt needs no card ids beyond the count and the destination. The
   * cards the effect showed carry `revealedTo` this player, so the leftovers are
   * exactly the revealed library cards they did not pick. Carrying the pool on
   * the prompt instead would put a library's top on the wire (D61).
   */
  if (awaiting.zone === 'library') {
    const lib = state.zones.library[intent.player] ?? [];
    const shown = lib.filter((id) => state.cards[id]?.revealedTo.includes(intent.player));
    for (const card of intent.cards) {
      if (!shown.includes(card)) return reject('wrongZone', 'That card is not one you are looking at.');
    }
    const rest = shown.filter((id) => !unique.has(id));
    const toHand = intent.cards.map((card) => ({
      card,
      from: { kind: 'library' as const, player: intent.player },
      to: { kind: 'hand' as const, player: intent.player },
    }));
    /**
     * ⚠️ The leftovers go to the BOTTOM, which is the FRONT of the array —
     * `drawFromTop` takes from the end, so "bottom" is index 0. A move that got
     * this backwards would put the cards the player just declined straight back
     * under their next draw.
     */
    const toRest = rest.map((card) =>
      awaiting.rest === 'graveyard'
        ? {
            card,
            from: { kind: 'library' as const, player: intent.player },
            to: { kind: 'graveyard' as const, player: state.cards[card]?.owner ?? intent.player },
          }
        : {
            card,
            from: { kind: 'library' as const, player: intent.player },
            to: { kind: 'library' as const, player: intent.player },
            // ⚠️ `placement` IS REQUIRED HERE. `addToZone` appends, and the top
            // of a library is the END of the array, so a move without it puts
            // the declined card straight back under the next draw — the exact
            // opposite of what "on the bottom" means, and invisible in any test
            // that only checked the card had left the revealed set.
            placement: 'bottom' as const,
          },
    );
    /**
     * ⚠️ **"IN ANY ORDER" CHAINS INTO A SECOND PROMPT** (D142). The pick is
     * answered; the SEQUENCE for the leftovers is a separate decision and gets
     * its own question, so the taken cards move now and the rest wait. One card
     * left has one sequence, so it skips the prompt — the same "a question with
     * one legal answer" rule every prompt in this file follows.
     */
    if ((awaiting.rest === 'bottomOrdered' || awaiting.rest === 'topOrdered') && rest.length > 1) {
      return accept([
        {
          t: 'AwaitingSet',
          awaiting: {
            kind: 'orderCards',
            player: intent.player,
            zone: 'library',
            destination: awaiting.rest === 'topOrdered' ? 'top' : 'bottom',
            count: rest.length,
            label: awaiting.label,
          },
        },
        { t: 'CardsMoved', moves: toHand },
        narrated(
          n`${who(state, intent.player)} ${vb(intent.player, 'takes', 'take')} ${intent.cards.length} card${intent.cards.length === 1 ? '' : 's'}.`,
          intent.player,
        ),
      ]);
    }

    return accept([
      { t: 'AwaitingSet', awaiting: null },
      { t: 'CardsMoved', moves: [...toHand, ...toRest] },
      // ⚠️ The reveal is CLEARED, or the player keeps seeing the cards that went
      // to the bottom for the rest of the game — `view.peek` reads `revealedTo`.
      { t: 'CardsRevealed', cards: [...shown], to: [] },
      narrated(
        n`${who(state, intent.player)} ${vb(intent.player, 'takes', 'take')} ${intent.cards.length} card${intent.cards.length === 1 ? '' : 's'} and ${vb(intent.player, 'puts', 'put')} ${rest.length} ${awaiting.rest === 'graveyard' ? 'into the graveyard' : 'on the bottom'}.`,
        intent.player,
      ),
    ]);
  }

  const hand = state.zones.hand[intent.player] ?? [];
  for (const card of intent.cards) {
    if (!hand.includes(card)) return reject('wrongZone', 'That card is not in your hand.');
  }

  const moves = intent.cards.map((card) => ({
    card,
    from: { kind: 'hand' as const, player: intent.player },
    to: { kind: 'graveyard' as const, player: state.cards[card]?.owner ?? intent.player },
  }));
  return accept([
    { t: 'AwaitingSet', awaiting: null },
    { t: 'CardsMoved', moves },
    narrated(
      n`${who(state, intent.player)} ${vb(intent.player, 'discards', 'discard')} ${intent.cards.length} card${intent.cards.length === 1 ? '' : 's'}.`,
      intent.player,
    ),
  ]);
}

/**
 * "…in any order" — the sequence the player chose. See D142.
 *
 * ⚠️ **THE PROMPT CARRIES NO IDS, so this is the whole legality check** — the
 * third prompt in a row built that way (D137, D141) and the same trade every
 * time: a hidden zone cannot be listed on the wire, so the handler pays for it.
 * The answer must be exactly the revealed set, each card once, no extras.
 *
 * ⚠️ **FIRST ENTRY FIRST, and the two destinations write it in OPPOSITE array
 * directions.** `addToZone` appends and the TOP of a library is the END of the
 * array, so a sequence going to the top must be applied in reverse to come out
 * the way the player read it. Getting this backwards is invisible to a test that
 * only checks the cards arrived.
 */
function answerOrderCards(
  state: GameState,
  intent: Extract<Intent, { t: 'AnswerOrderCards' }>,
): HandleResult {
  const awaiting = state.priority.awaiting;
  if (awaiting?.kind !== 'orderCards' || awaiting.player !== intent.player) {
    return reject('notAwaitingThat', 'You are not being asked to order anything.');
  }
  const lib = state.zones.library[intent.player] ?? [];
  const shown = lib.filter((id) => state.cards[id]?.revealedTo.includes(intent.player));
  if (intent.cards.length !== shown.length) {
    return reject('invalidAmount', `Order all ${shown.length} cards.`);
  }
  const unique = new Set(intent.cards);
  if (unique.size !== intent.cards.length) {
    return reject('noSuchCard', 'You named the same card twice.');
  }
  for (const card of intent.cards) {
    if (!shown.includes(card)) return reject('wrongZone', 'That card is not one you are ordering.');
  }

  /**
   * ⚠️ **REVERSED FOR BOTH ENDS, and the symmetry is not a coincidence.** The
   * player's FIRST card must end up nearest the destination, and each placement
   * puts the card it applies at that end — appending for the top, unshifting for
   * the bottom. So whichever end it is, the LAST card applied is the one that
   * lands nearest it, and the sequence has to go on backwards.
   *
   * ⚠️ The first cut reversed only for the top, reasoning about appending alone,
   * and bottomed `Impulse`'s three cards in exactly the wrong order. Its own test
   * caught it; nothing else would have, because the cards all arrive either way.
   */
  const sequence = [...intent.cards].reverse();
  const moves = sequence.map((card) => ({
    card,
    from: { kind: 'library' as const, player: intent.player },
    to: { kind: 'library' as const, player: intent.player },
    placement: awaiting.destination,
  }));
  return accept([
    { t: 'AwaitingSet', awaiting: null },
    { t: 'CardsMoved', moves },
    { t: 'CardsRevealed', cards: [...shown], to: [] },
    narrated(
      n`${who(state, intent.player)} ${vb(intent.player, 'puts', 'put')} ${intent.cards.length} cards on the ${awaiting.destination} of ${their(intent.player)} library.`,
      intent.player,
    ),
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
