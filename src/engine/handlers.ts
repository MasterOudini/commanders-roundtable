// `handle(state, intent, deps) → Event[] | Reject`. The only way a player
// changes the game.
//
// ⚠️ Every rejection message is written FROM THE PLAYER'S SIDE and says what to
// do next, because a rejection is the one place the engine talks to a human who
// has just been told "no". "notYourPriority" is a code for the client; "Ana has
// priority — wait for her to pass" is the message.

import { askPromptFor, resumeReplacementFunnel, revealAdmits, runReplacementFunnel } from './triggers';
import {
  legalDefenders,
  needsFirstStrikeSubstep,
  canAttack,
  canAttackDefender,
  mustNotAttackAlone,
  requiredAttackers,
  validateBlockDeclaration,
} from './combat';
import { derive, makeDeriveCache } from './derive';
import {
  activatedDefRegistered,
  NINJUTSU_STEPS,
  canActAtSorcerySpeed,
  castableFaces,
  castsForetold,
  castsWarped,
  castsPlotted,
  castTargetSpecs,
  splitSecondOnStack,
  FORETELL_COST,
  discardCandidatesFor,
  exileFromGraveyardCandidatesFor,
  sacrificeCandidatesFor,
  tapCandidatesFor,
  removeCounterCandidatesFor,
  countersOfKind,
  returnCandidatesFor,
  castCostCandidates,
  exileFromHandCandidates,
  type CostVerbs,
} from './legal';
import { DISGUISE_WARD, buildPaymentProblem, costStringOf, extraCostSpend, manaSourcesOf, wardTaxFrom, type ManaSource } from './mana';
import { freeCastAdmits, handChoiceAdmits } from './handChoice';
import { isDetained } from './detain';
import { goadersOf } from './goad';
import { clashBegin, clashFinish, clashOpponentStep } from './clash';
import { hybridCombinations, spendFromPool } from './mana';
import { faceOf } from './oracle';
import { parseManaCost } from '../data/oracleParse';
import { castReduction } from './costs';
import { NO_ALT, altCount, applyAlternativePayment, assignAlternativePayment, type AltChoice, type ConvokeCandidate } from './altPayment';
import type { SolveInput } from './payment';
import type { PaymentProblem } from './types/mana';
import { suggestPayment, solveInputFor, validatePlan } from './payment';
import { OTHER_PURPOSE, abilityPurpose, bucketsFitting, fitPool, restrictedOfSpend, spellPurpose, type SpendPurpose } from './spend';
import type { RestrictedMana } from './types/mana';
import { manualIntent } from './manual';
import { flipCoin, rollDie, shuffle } from './rng';
import { n, narrated, their, vb, who } from './narrate';
import { askBatch, askCandidates, drawEvents, effectResult, mergeExceptions, resumeContinuation, suspendTick } from './effects';
import { proliferateCandidates } from './proliferate';
import { exploreChain } from './explore';
import { conniveAfterDiscard } from './connive';
import { apply } from './reducer';
import { bottomCountFor, drawFromTop } from './setup';
import { abilityOfRef, activatedModesFor, canExert, legalModesFor, resolveAbility, stackPendingTriggers, targetingSourceFor, triggerDefFor, type EngineDeps } from './loop';
import { modeChoiceProblem, modeSpecs, modesInOrder } from './modes';
import { activationConditionsHold, describeActivationConditions } from './activationConditions';
import type { CardMove, EventBody } from './types/events';
import type { AbilityRef, InstanceId, PlayerId, StackId, ZoneRef } from './types/ids';
import type {
  ModeDecl,
  SearchQualifier,
  TargetSpec,
  VerbPrice,
} from './types/oracle';
import { predicateAdmits, type PermanentPredicate } from '../data/replacementParse';
import { candidatesFromState, validateTargets } from './targets';
import { EMPTY_POOL, addPool, poolFrom, type ManaCost, type ManaPool, type ManaSymbolKey } from './types/mana';
import {
  accept,
  reject,
  type HandleResult,
  type Intent,
} from './types/intents';
import type { Awaiting, EffectContinuation, GameState, PendingCast, StackObject, TargetChoice } from './types/state';

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
    case 'ChooseModes':
      return chooseModes(state, intent, deps);
    case 'ActivateAbility':
      return activateAbility(state, intent, deps);
    case 'ChooseTargets':
      return chooseTargets(state, intent, deps);
    case 'PayCast':
      return payCast(state, intent, deps);
    case 'TurnFaceUp':
      return turnFaceUp(state, intent, deps);
    case 'Suspend':
      return suspend(state, intent, deps);
    case 'Foretell':
      return foretell(state, intent, deps);
    case 'Plot':
      return plot(state, intent, deps);
    case 'CancelPendingCast':
      return cancelPendingCast(state, intent.player, deps);
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
    case 'AnswerChooseCopy':
      return answerChooseCopy(state, intent, deps);
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
    case 'AnswerChoosePlayer':
      return answerChoosePlayer(state, intent, deps);
    case 'AnswerChooseCreatureType':
      return answerChooseCreatureType(state, intent, deps);
    case 'AnswerEntersChoice':
      return answerEntersChoice(state, intent, deps);
    case 'AnswerPayMana':
      return answerPayMana(state, intent, deps);
    case 'AnswerSearchLibrary':
      return answerSearchLibrary(state, intent, deps);
    case 'AnswerChooseFromZone':
      return answerChooseFromZone(state, intent, deps);
    case 'AnswerOrderCards':
      return answerOrderCards(state, intent, deps);
    case 'AnswerScry':
      return answerScry(state, intent, deps);
    case 'AnswerProliferate':
      return answerProliferate(state, intent, deps);
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
  // D417 - a land in exile under a play permission is played as though from the hand.
  const permitted = card.zone.kind === 'exile' && state.playPermissions.some((p) => p.card === intent.card && p.player === intent.player);
  if (!permitted && (card.zone.kind !== 'hand' || card.zone.player !== intent.player)) {
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
          from: permitted ? { kind: 'exile' as const, player: card.zone.player } : { kind: 'hand' as const, player: intent.player },
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
  /** D309 - a face-down (morph) cast: {3}, a nameless colorless 2/2. */
  readonly faceDown?: boolean;
  /** D403 - the kicker count the cast announced (0 when unkicked), priced into `problem`. */
  readonly kicked: number;
  /** D530 - a two-kicker face: which costs the kick pays (empty for every other face). */
  readonly kickedWith: readonly number[];
  /** D535 - the buyback was paid (CR 702.27), priced into `problem`; the stack object remembers it. */
  readonly buyback: boolean;
  /** D556 - the replicate count (CR 702.56a), priced into `problem`; the stack object remembers it. */
  readonly replicated: number;
  /** D405 - what the cast taps or exiles (convoke / improvise / delve), priced into `problem`. */
  readonly alt: AltChoice;
  /** D406 - the picks of the additional cost's chooser verb, paid in the cost batch; `orPaid` when the `or pay {M}` alternative stands in. */
  readonly picks: CastPicks;
  readonly orPaid: boolean;
  /** D408 - the alternative cost was elected: the picks above pay ITS verb and pitch, its mana replaced the mana cost. */
  readonly alternative: boolean;
  /** D491 - a cast GRANTED by a resolving effect: nothing to pay but the ward and the additional cost's price. */
  readonly free?: true;
  /** D540 - a FORETOLD cast from exile (CR 702.143a): the turn the card was foretold; its foretell cost priced into `problem`. */
  readonly foretold?: number;
  /** D551 - a PLOTTED cast from exile (CR 702.170d): the turn the card was plotted (the cast is `free`). */
  readonly plotted?: number;
  /** D541 - a MADNESS cast (CR 702.35a): the madness cost priced into `problem`. */
  readonly madness?: true;
}

/** D406 - the picks a cast names for its additional cost's chooser verb. */
interface CastPicks {
  readonly sacrifice: readonly InstanceId[];
  readonly discard: readonly InstanceId[];
  readonly tap: readonly InstanceId[];
  readonly exileFromGraveyard: readonly InstanceId[];
  readonly returnToHand: readonly InstanceId[];
  /** D408 - the pitch of an alternative cost (hand cards to exile). */
  readonly exileFromHand: readonly InstanceId[];
}
const NO_PICKS: CastPicks = { sacrifice: [], discard: [], tap: [], exileFromGraveyard: [], returnToHand: [], exileFromHand: [] };
const picksCount = (p: CastPicks): number => p.sacrifice.length + p.discard.length + p.tap.length + p.exileFromGraveyard.length + p.returnToHand.length + p.exileFromHand.length;
const picksOf = (p: { readonly sacrifice?: readonly InstanceId[]; readonly discard?: readonly InstanceId[]; readonly tap?: readonly InstanceId[]; readonly exileFromGraveyard?: readonly InstanceId[]; readonly returnToHand?: readonly InstanceId[]; readonly exileFromHand?: readonly InstanceId[] }): CastPicks => ({
  sacrifice: p.sacrifice ?? [], discard: p.discard ?? [], tap: p.tap ?? [], exileFromGraveyard: p.exileFromGraveyard ?? [], returnToHand: p.returnToHand ?? [], exileFromHand: p.exileFromHand ?? [],
});

/**
 * D406 - is what the cast names the ADDITIONAL COST's price? Exactly the count, distinct, from the
 * offer's own candidates (`castCostCandidates`, D139: one list); no picks with `or pay {M}` printed
 * takes the mana instead (`orPaid`); a face with no such cost takes no picks at all.
 */
// D530 - the kicker paid by a cost that is not only mana: charged as the additional cost is, when the cast is kicked.
// D535 - and a buyback paid by one, when the cast buys the spell back (the two are never printed together).
function kickVerbOf(face: ReturnType<typeof faceOf>, kicked: number, buyback = false): NonNullable<ReturnType<typeof faceOf>['kickerVerb']> | null {
  return kicked > 0 && face.kickerVerb !== null ? face.kickerVerb : buyback ? face.buybackVerb : null;
}

function additionalCostProblem(state: GameState, deps: EngineDeps, player: PlayerId, cardId: InstanceId, face: ReturnType<typeof faceOf>, picks: CastPicks, kickVerb: ReturnType<typeof kickVerbOf> = null): { orPaid: boolean } | { error: HandleResult } {
  // D530 - a kicked verb kicker takes the picks; a face that prints both takes none of this (never printed together).
  if (kickVerb !== null && face.additionalCost !== null) return { error: reject('notCastable', `${face.name}'s kicker and its additional cost both take picks - the app charges one.`) };
  const add = face.additionalCost ?? kickVerb;
  if (!add) return picksCount(picks) > 0 ? { error: reject('notCastable', `${face.name} has no additional cost the app charges.`) } : { orPaid: false };
  return costPicksProblem(state, deps, player, cardId, face.name, add, picks);
}

/** D406 / D408 - one validation for the additional cost's verb and the alternative cost's verb (the shape both print). */
function costPicksProblem(state: GameState, deps: EngineDeps, player: PlayerId, cardId: InstanceId, faceName: string, add: CostVerbs & { readonly costText: string; readonly orPay?: ManaCost | null }, picks: CastPicks): { orPaid: boolean } | { error: HandleResult } {
  const face = { name: faceName };
  const cache = makeDeriveCache(state);
  const cand = castCostCandidates(state, (cid) => derive(state, deps.oracle, deps.scripts, cid, cache), player, cardId, add);
  const VERBS = [
    [add.sacrificeCost, picks.sacrifice, 'sacrificeCandidates', 'needsSacrifice', 'illegalSacrifice', 'sacrifices', 'permanent'],
    [add.discardCost, picks.discard, 'discardCandidates', 'needsDiscard', 'illegalDiscard', 'discards', 'card'],
    [add.tapCost, picks.tap, 'tapCandidates', 'needsTap', 'illegalTap', 'taps', 'untapped permanent'],
    [add.exileFromGraveyardCost, picks.exileFromGraveyard, 'exileFromGraveyardCandidates', 'needsExileFromGraveyard', 'illegalExileFromGraveyard', 'exiles', 'card from your graveyard'],
    [add.returnCost, picks.returnToHand, 'returnCandidates', 'needsReturn', 'illegalReturn', 'returns', 'permanent'],
  ] as const;
  let orPaid = false;
  for (const [cost, got, key, needs, illegal, verb, noun] of VERBS) {
    if (cost === null) {
      if (got.length > 0) return { error: reject('notCastable', `${face.name}'s additional cost is to ${add.costText}, not that.`) };
      continue;
    }
    if (got.length === 0 && add.orPay) { orPaid = true; continue; }
    if (got.length !== cost.count) return { error: reject(needs, `${face.name}'s additional cost ${verb} ${cost.count} ${noun}${cost.count === 1 ? '' : 's'} - say which.`) };
    if (new Set(got).size !== got.length) return { error: reject('noSuchCard', 'You named the same card twice.') };
    const legal = (cand.fields[key] ?? []) as readonly InstanceId[];
    if (!got.every((c) => legal.includes(c))) return { error: reject(illegal, `Those cannot pay ${face.name}'s additional cost (${add.costText}).`) };
  }
  return { orPaid };
}

/** D406 - what the additional cost adds to the payment problem: the `or pay {M}` mana when taken, the life otherwise. */
function additionalExtras(face: ReturnType<typeof faceOf>, orPaid: boolean, kickVerb: ReturnType<typeof kickVerbOf> = null): { readonly mana: ManaCost[]; readonly life: number } {
  // D530 - the verb kicker's life rides the problem as the additional cost's does (its mana is the kicker's, `kickerMana`).
  const add = face.additionalCost ?? kickVerb;
  if (!add) return { mana: [], life: 0 };
  return { mana: orPaid && add.orPay ? [add.orPay] : [], life: orPaid ? 0 : add.lifeCost };
}

/**
 * D406 - the additional cost's picks paid in the cost batch, through the ordinary moves so the watchers
 * see them as any sacrifice, discard, tap, exile or return (the activated cost batch's shapes, D168 /
 * D286 / D329 / D352); the life rides the payment plan. Re-checked here because the X and targets
 * stages may have sat between the choice and the charge.
 */
function additionalCostEvents(state: GameState, deps: EngineDeps, player: PlayerId, identity: readonly import('../data/cardTypes').ColorLetter[], picks: CastPicks): { events: EventBody[] } | { error: HandleResult } {
  const events: EventBody[] = [];
  if (picks.sacrifice.length > 0) {
    const moves: { card: InstanceId; from: { kind: 'battlefield'; player: PlayerId }; to: { kind: 'graveyard'; player: PlayerId }; reason: 'sacrifice' }[] = [];
    let chosen = state.cards[picks.sacrifice[0] as InstanceId];
    for (const id of picks.sacrifice) {
      const inst = state.cards[id];
      if (!inst || inst.zone.kind !== 'battlefield') return { error: reject('noSuchCard', 'A permanent chosen for the sacrifice is not on the battlefield.') };
      chosen = inst;
      moves.push({ card: id, from: { kind: 'battlefield', player: inst.controller }, to: { kind: 'graveyard', player: inst.owner }, reason: 'sacrifice' });
    }
    events.push({ t: 'CardsMoved', moves });
    const chosenPrinting = chosen ? deps.oracle.byPrinting(chosen.printingId) : null;
    const chosenName = moves.length > 1 ? `${moves.length} permanents` : chosenPrinting && chosen ? faceOf(chosenPrinting, chosen.faceIndex).name : 'a permanent';
    events.push(narrated(n`${who(state, player)} ${vb(player, 'sacrifices', 'sacrifice')} ${chosenName}.`, player, identity));
  }
  if (picks.discard.length > 0) {
    const moves: { card: InstanceId; from: { kind: 'hand'; player: PlayerId }; to: { kind: 'graveyard'; player: PlayerId }; reason: 'discard' }[] = [];
    for (const chosen of picks.discard) {
      const inst = state.cards[chosen];
      if (!inst || inst.zone.kind !== 'hand' || inst.zone.player !== player) return { error: reject('noSuchCard', 'A card chosen for the discard is no longer in your hand.') };
      moves.push({ card: chosen, from: { kind: 'hand', player }, to: { kind: 'graveyard', player: inst.owner }, reason: 'discard' });
    }
    events.push({ t: 'CardsMoved', moves });
    events.push(narrated(n`${who(state, player)} ${vb(player, 'discards', 'discard')} ${moves.length} card${moves.length === 1 ? '' : 's'}.`, player, identity));
  }
  if (picks.tap.length > 0) {
    for (const chosen of picks.tap) {
      const inst = state.cards[chosen];
      if (!inst || inst.zone.kind !== 'battlefield' || inst.tapped || inst.controller !== player) return { error: reject('noSuchCard', 'A permanent chosen to tap is no longer untapped under your control.') };
    }
    events.push({ t: 'PermanentsTapped', cards: [...picks.tap] });
    events.push(narrated(n`${who(state, player)} ${vb(player, 'taps', 'tap')} ${picks.tap.length} permanent${picks.tap.length === 1 ? '' : 's'}.`, player, identity));
  }
  if (picks.exileFromGraveyard.length > 0) {
    const moves: { card: InstanceId; from: { kind: 'graveyard'; player: PlayerId }; to: { kind: 'exile'; player: PlayerId } }[] = [];
    for (const chosen of picks.exileFromGraveyard) {
      const inst = state.cards[chosen];
      if (!inst || inst.zone.kind !== 'graveyard' || inst.zone.player !== player) return { error: reject('noSuchCard', 'A card chosen for the exile is no longer in your graveyard.') };
      moves.push({ card: chosen, from: { kind: 'graveyard', player }, to: { kind: 'exile', player: inst.owner } });
    }
    events.push({ t: 'CardsMoved', moves });
    events.push(narrated(n`${who(state, player)} ${vb(player, 'exiles', 'exile')} ${moves.length} card${moves.length === 1 ? '' : 's'} from the graveyard.`, player, identity));
  }
  if (picks.returnToHand.length > 0) {
    const moves: { card: InstanceId; from: { kind: 'battlefield'; player: PlayerId }; to: { kind: 'hand'; player: PlayerId } }[] = [];
    for (const chosen of picks.returnToHand) {
      const inst = state.cards[chosen];
      if (!inst || inst.zone.kind !== 'battlefield' || inst.controller !== player) return { error: reject('noSuchCard', 'A permanent chosen to return is no longer on the battlefield under your control.') };
      moves.push({ card: chosen, from: { kind: 'battlefield', player }, to: { kind: 'hand', player: inst.owner } });
    }
    events.push({ t: 'CardsMoved', moves });
    events.push(narrated(n`${who(state, player)} ${vb(player, 'returns', 'return')} ${moves.length} permanent${moves.length === 1 ? '' : 's'} to hand.`, player, identity));
  }
  // D408 - the pitch: the named hand cards go to exile in the cost batch.
  if (picks.exileFromHand.length > 0) {
    const moves: { card: InstanceId; from: { kind: 'hand'; player: PlayerId }; to: { kind: 'exile'; player: PlayerId } }[] = [];
    for (const chosen of picks.exileFromHand) {
      const inst = state.cards[chosen];
      if (!inst || inst.zone.kind !== 'hand' || inst.zone.player !== player) return { error: reject('noSuchCard', 'A card chosen to exile is no longer in your hand.') };
      moves.push({ card: chosen, from: { kind: 'hand', player }, to: { kind: 'exile', player: inst.owner } });
    }
    events.push({ t: 'CardsMoved', moves });
    events.push(narrated(n`${who(state, player)} ${vb(player, 'exiles', 'exile')} ${moves.length} card${moves.length === 1 ? '' : 's'} from hand.`, player, identity));
  }
  return { events };
}

/**
 * D408 - the ALTERNATIVE COST elected (`CastSpell.alternative`): the face must print one the grammar
 * read, its conditions must hold now (the activation grammar's checker, D342), and its pitch - so many
 * hand cards of the printed colour, never the spell itself - is checked here; the chooser verb's picks
 * go through the same validation as the additional cost's (`costPicksProblem`).
 */
function alternativeCostProblem(state: GameState, deps: EngineDeps, player: PlayerId, cardId: InstanceId, face: ReturnType<typeof faceOf>, exileFromHand: readonly InstanceId[]): { alt: NonNullable<ReturnType<typeof faceOf>['alternativeCost']> } | { error: HandleResult } {
  const alt = face.alternativeCost;
  if (!alt) return { error: reject('notCastable', `${face.name} has no alternative cost the app charges.`) };
  if (alt.conditions.length > 0 && !activationConditionsHold(state, deps.oracle, deps.scripts, player, cardId, alt.conditions, makeDeriveCache(state))) {
    return { error: reject('notCastable', `${face.name}'s alternative cost (${alt.costText}) cannot be paid now.`) };
  }
  if (alt.exileFromHand) {
    const want = alt.exileFromHand.count;
    if (exileFromHand.length !== want) return { error: reject('needsDiscard', `${face.name}'s alternative cost exiles ${want} card${want === 1 ? '' : 's'} from your hand - say which.`) };
    if (new Set(exileFromHand).size !== exileFromHand.length) return { error: reject('noSuchCard', 'You named the same card twice.') };
    const legal = exileFromHandCandidates(state, deps.oracle, player, cardId, alt.exileFromHand);
    if (!exileFromHand.every((c) => legal.includes(c))) return { error: reject('illegalDiscard', `Those cards cannot pay ${face.name}'s alternative cost (${alt.costText}).`) };
  } else if (exileFromHand.length > 0) {
    return { error: reject('notCastable', `${face.name}'s alternative cost is to ${alt.costText}, not that.`) };
  }
  return { alt };
}


/**
 * D405 - CONVOKE / IMPROVISE / DELVE: is what the cast names something this face can tap or exile
 * for its cost? A creature the caster controls, untapped; an artifact the caster controls,
 * untapped; a card in the caster's graveyard; each named once. Null when every choice is fine.
 */
function altProblem(state: GameState, deps: EngineDeps, player: PlayerId, face: ReturnType<typeof faceOf>, alt: AltChoice, faceDown: boolean): string | null {
  if (altCount(alt) === 0) return null;
  if (faceDown) return 'A face-down spell cannot be paid by convoke, improvise or delve.';
  if (alt.convoke.length > 0 && !face.convoke) return `${face.name} has no convoke.`;
  if (alt.improvise.length > 0 && !face.improvise) return `${face.name} has no improvise.`;
  if (alt.delve.length > 0 && !face.delve) return `${face.name} has no delve.`;
  const seen = new Set<InstanceId>();
  const cache = makeDeriveCache(state);
  const nameOf = (id: InstanceId): string => derive(state, deps.oracle, deps.scripts, id, cache).name;
  for (const [kind, ids] of [['convoke', alt.convoke], ['improvise', alt.improvise], ['delve', alt.delve]] as const) {
    for (const id of ids) {
      const inst = state.cards[id];
      if (!inst) return 'That card is not in the game.';
      if (seen.has(id)) return `${nameOf(id)} is named twice.`;
      seen.add(id);
      if (kind === 'delve') {
        if (inst.zone.kind !== 'graveyard' || inst.zone.player !== player) return `${nameOf(id)} is not in your graveyard.`;
        continue;
      }
      if (inst.zone.kind !== 'battlefield' || inst.controller !== player) return `${nameOf(id)} is not a permanent you control.`;
      if (inst.tapped) return `${nameOf(id)} is already tapped.`;
      const d = derive(state, deps.oracle, deps.scripts, id, cache);
      if (kind === 'convoke' && !d.isCreature) return `${d.name} is not a creature.`;
      if (kind === 'improvise' && !d.typeLine.types.includes('Artifact')) return `${d.name} is not an artifact.`;
    }
  }
  return null;
}

/**
 * D405 - the problem with the alternatives taken off it, or the choice that pays for nothing, by
 * name. The assignment is the shared one (`altPayment.ts`): the client's preview prices the same
 * symbols (D53). Read by every rebuild of the problem, so X and the targets reprice the same choices.
 */
function priceAlternatives(state: GameState, deps: EngineDeps, face: ReturnType<typeof faceOf>, base: PaymentProblem, alt: AltChoice): { problem: PaymentProblem } | { error: HandleResult } {
  if (altCount(alt) === 0) return { problem: base };
  const cache = makeDeriveCache(state);
  const convoke: ConvokeCandidate[] = alt.convoke.map((id) => ({ id, colors: derive(state, deps.oracle, deps.scripts, id, cache).colors }));
  const assigned = assignAlternativePayment(base, convoke, alt.improvise.length, alt.delve.length);
  if (assigned.failed) {
    const list = assigned.failed.kind === 'convoke' ? alt.convoke : assigned.failed.kind === 'improvise' ? alt.improvise : alt.delve;
    const id = list[assigned.failed.index];
    const name = id !== undefined ? derive(state, deps.oracle, deps.scripts, id, cache).name : 'That';
    return { error: reject('notCastable', `${name} would pay for nothing: ${face.name} has no symbol left for it.`) };
  }
  return { problem: applyAlternativePayment(base, assigned.paid) };
}

/** D405 - the taps and the exiles the alternatives pay with, ahead of the mana (CR 601.2h). */
function altEvents(state: GameState, player: PlayerId, alt: AltChoice): EventBody[] {
  const out: EventBody[] = [];
  const tapped = [...alt.convoke, ...alt.improvise];
  if (tapped.length > 0) out.push({ t: 'PermanentsTapped', cards: tapped });
  if (alt.delve.length > 0) {
    out.push({
      t: 'CardsMoved',
      moves: alt.delve.map((card) => ({ card, from: { kind: 'graveyard' as const, player }, to: { kind: 'exile' as const, player: state.cards[card]?.owner ?? player } })),
    });
  }
  return out;
}

/** D405 - a solve input without the permanents the cast taps for its alternatives: a mana creature convoked cannot also be tapped for mana. */
function solveWithout(solve: SolveInput, alt: AltChoice, tapped: readonly InstanceId[] = []): SolveInput {
  if (alt.convoke.length + alt.improvise.length + tapped.length === 0) return solve;
  const gone = new Set<InstanceId>([...alt.convoke, ...alt.improvise, ...tapped]);
  return { ...solve, sources: solve.sources.filter((s) => !gone.has(s.card)) };
}

/** D405 - does the mana plan tap a permanent the cast already taps for convoke or improvise? */
function planTapsAlt(plan: import('./types/mana').PaymentPlan, alt: AltChoice, tapped: readonly InstanceId[] = []): boolean {
  return plan.taps.some((t) => alt.convoke.includes(t.source) || alt.improvise.includes(t.source) || tapped.includes(t.source));
}

/** D406 - the count the stack object remembers: the picks, a life payment as one, the mana alternative as one. */
function additionalPaidOf(face: ReturnType<typeof faceOf>, picks: CastPicks, orPaid: boolean): { additionalPaid?: number } {
  if (!face.additionalCost) return {};
  return { additionalPaid: picksCount(picks) + (orPaid ? 1 : 0) + (!orPaid && face.additionalCost.lifeCost > 0 ? 1 : 0) };
}

/** D405 - the counts the stack object remembers, only when something was tapped or exiled. */
function altCounts(alt: AltChoice): { convoked?: number; improvised?: number; delved?: number } {
  return {
    ...(alt.convoke.length > 0 ? { convoked: alt.convoke.length } : {}),
    ...(alt.improvise.length > 0 ? { improvised: alt.improvise.length } : {}),
    ...(alt.delve.length > 0 ? { delved: alt.delve.length } : {}),
  };
}

/** D405 - the narration's tail: ` (convoke 2, delve 3)`, or nothing. */
function altNote(alt: AltChoice): string {
  const parts: string[] = [];
  if (alt.convoke.length > 0) parts.push(`convoke ${alt.convoke.length}`);
  if (alt.improvise.length > 0) parts.push(`improvise ${alt.improvise.length}`);
  if (alt.delve.length > 0) parts.push(`delve ${alt.delve.length}`);
  return parts.length > 0 ? ` (${parts.join(', ')})` : '';
}

/**
 * D403 - KICKER (CR 702.33): the additional mana a kick adds to the problem - the kicker cost once,
 * or the multikicker cost `kicked` times. The caller has already refused a count the face cannot
 * take (`kickProblem`). Read by every rebuild of the problem, so the X and targets stages price
 * the same kick the announcement did (D53: one payment previewed, the same one charged).
 */
function kickerMana(face: ReturnType<typeof faceOf>, kicked: number, kickedWith: readonly number[] = []): ManaCost[] {
  if (kicked <= 0) return [];
  if (face.multikickerCost !== null) return Array.from({ length: kicked }, () => face.multikickerCost as ManaCost);
  // D530 - a two-kicker face pays the costs the cast named; a verb kicker its mana piece (the verb is the picks').
  if (face.kickerCost2 !== null) return kickersOf(kicked, kickedWith).map((i) => (i === 0 ? face.kickerCost : face.kickerCost2) as ManaCost);
  if (face.kickerVerb !== null) return face.kickerVerb.mana !== null ? [face.kickerVerb.mana] : [];
  return face.kickerCost !== null ? [face.kickerCost] : [];
}
/** D530 - the kicker costs a two-kicker cast pays: the ones it named, else the first `kicked` in order. */
function kickersOf(kicked: number, kickedWith: readonly number[]): readonly number[] {
  if (kickedWith.length > 0) return kickedWith;
  return kicked >= 2 ? [0, 1] : kicked === 1 ? [0] : [];
}
/**
 * D535 - the cost a STAGED cast keeps paying when X or its targets reprice the problem: what `prepareCast` charged - nothing
 * for a granted cast (D491), the alternative cost's mana (D408; its life is `stagedCastLife`), {3} face down (D309), the
 * flashback cost from the graveyard (D307). The targets stage had repriced every one of them at the printed cost.
 */
function stagedCastCost(face: ReturnType<typeof faceOf>, pending: { readonly free?: true; readonly alternative?: true; readonly faceDown?: true; readonly foretold?: number; readonly madness?: true; readonly from: ZoneRef }): ManaCost | null {
  if (pending.free === true) return null;
  if (pending.alternative === true && face.alternativeCost !== null) return face.alternativeCost.mana;
  if (pending.faceDown === true) return MORPH_CAST_COST;
  // D541 - a madness cast keeps paying its madness cost.
  if (pending.madness === true && face.madnessCost !== null) return face.madnessCost;
  // D540 - a foretold cast keeps paying its foretell cost.
  if (pending.foretold !== undefined && face.foretellCost !== null) return face.foretellCost;
  if (pending.from.kind === 'graveyard' && face.flashbackCost !== null) return face.flashbackCost;
  return face.manaCost;
}
/** D535 - the life an elected alternative cost adds to a staged cast's problem (`prepareCast` adds the same). */
function stagedCastLife(face: ReturnType<typeof faceOf>, pending: { readonly alternative?: true }): number {
  return pending.alternative === true && face.alternativeCost !== null ? face.alternativeCost.lifeCost : 0;
}
/** D535 - BUYBACK (CR 702.27): the mana a bought-back cast adds - the buyback cost, or a verb buyback's mana piece. */
function buybackMana(face: ReturnType<typeof faceOf>, buyback: boolean): ManaCost[] {
  if (!buyback) return [];
  if (face.buybackCost !== null) return [face.buybackCost];
  return face.buybackVerb?.mana ? [face.buybackVerb.mana] : [];
}
/** D535 - why a buyback cannot be announced on this cast, or null when it can. */
function buybackProblem(face: ReturnType<typeof faceOf>, buyback: boolean, kicked: number, faceDown: boolean): string | null {
  if (!buyback) return null;
  if (faceDown) return 'A face-down spell cannot be bought back.';
  if (face.buybackCost === null && face.buybackVerb === null) return `${face.name} has no buyback the app can charge.`;
  if (face.buybackVerb !== null && (face.additionalCost !== null || (kicked > 0 && face.kickerVerb !== null))) return `${face.name}'s buyback and another cost both take picks - the app charges one.`;
  return null;
}
/** D556 - REPLICATE (CR 702.56a): the mana a replicated cast adds - the replicate cost once per payment. */
function replicateMana(face: ReturnType<typeof faceOf>, replicated: number): ManaCost[] {
  if (replicated <= 0 || face.replicateCost === null) return [];
  return Array.from({ length: replicated }, () => face.replicateCost as ManaCost);
}
/** D556 - why a replicate count cannot be announced on this cast, or null when it can. */
function replicateProblem(face: ReturnType<typeof faceOf>, replicated: number, faceDown: boolean): string | null {
  if (!Number.isInteger(replicated) || replicated < 0) return 'The replicate count must be zero or more.';
  if (replicated === 0) return null;
  if (faceDown) return 'A face-down spell cannot be replicated.';
  if (face.replicateCost === null) return `${face.name} has no replicate cost the app can charge.`;
  return null;
}
/** D403 - why a kick count cannot be announced on this face, or null when it can. */
function kickProblem(face: ReturnType<typeof faceOf>, kicked: number, kickedWith: readonly number[] = []): string | null {
  if (!Number.isInteger(kicked) || kicked < 0) return 'The kicker count must be zero or more.';
  if (kickedWith.length > 0 && face.kickerCost2 === null) return `${face.name} has one kicker - there is none to name.`;
  if (kicked === 0) return kickedWith.length > 0 ? 'An unkicked cast names no kicker.' : null;
  if (face.multikickerCost !== null) return null;
  // D530 - two kickers: each at most once, the count and the named costs agreeing (CR 702.33c).
  if (face.kickerCost2 !== null) {
    if (kicked > 2) return `${face.name} has two kickers - it can be kicked twice at most.`;
    const w = kickersOf(kicked, kickedWith);
    if (w.length !== kicked || new Set(w).size !== w.length || w.some((i) => i !== 0 && i !== 1)) return `Name ${kicked} of ${face.name}'s two kickers, each once.`;
    return null;
  }
  if (face.kickerCost === null && face.kickerVerb === null) return `${face.name} has no kicker the app can charge.`;
  return kicked === 1 ? null : `${face.name} can be kicked once.`;
}

/** D309 - the cost of casting any card face down (CR 702.37a). */
const MORPH_CAST_COST = parseManaCost('{3}');

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
    // D460 - a face-down permanent has no printed ward (CR 708.2); a DISGUISED one has ward {2} (CR 702.168c).
    // The client reads the same fact off the public view flag - the same constant, the same sum.
    if (card.faceDown) {
      if (faceOf(oracleCard, 0).disguise) faces.push(DISGUISE_WARD);
      continue;
    }
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
  faceDown = false,
  kicked = 0,
  alt: AltChoice = NO_ALT,
  picks: CastPicks = NO_PICKS,
  alternative = false,
  // D491 - a cast granted by a resolving effect (`You may cast ... from your hand without paying its mana cost`):
  // no mana cost, no timing of its own, no priority of its own (nobody holds it while a spell resolves).
  free = false,
  // D530 - a two-kicker face: which of its kickers the cast pays.
  kickedWith0: readonly number[] = [],
  // D535 - the buyback is paid (CR 702.27).
  buyback = false,
  // D541 - a MADNESS cast (CR 702.35a), begun as the madness trigger resolves.
  madness = false,
  // D556 - the replicate count (CR 702.56a).
  replicated = 0,
): CastSetup | { error: HandleResult } {
  const card = state.cards[cardId];
  if (!card) return { error: reject('noSuchCard', 'That card is not in the game.') };
  const oracleCard = deps.oracle.byPrinting(card.printingId);
  if (!oracleCard) return { error: reject('noSuchCard', 'That card is not in the card database.') };
  const face = faceOf(oracleCard, faceIndex);
  // D550 - SPLIT SECOND (CR 702.61a): no spell is cast while one is on the stack - every cast path, a free one too.
  if (splitSecondOnStack(state, deps.oracle)) {
    return { error: reject('timingRestriction', 'A spell with split second is on the stack - no spell can be cast until it resolves.') };
  }
  // D309 - THE MORPH SEAM: cast face down as a 2/2 for {3} (CR 702.37a) - a
  // creature spell at sorcery speed, from the hand, no targets, whatever the
  // card's own cost or type (Zoetic Cavern is a land).
  if (faceDown && (face.morphCost === null || card.zone.kind !== 'hand' || faceIndex !== 0)) {
    return { error: reject('notCastable', `${face.name} cannot be cast face down from there.`) };
  }
  if (!faceDown && (face.manaCost === null || face.isLand)) {
    return { error: reject('notCastable', `${face.name} cannot be cast.`) };
  }
  const from: ZoneRef = { kind: card.zone.kind, player: card.zone.player };
  // D307 - FLASHBACK: the graveyard is a place to cast from when the face
  // prints a flashback cost the engine can pay (CR 702.34a).
  const flashback = from.kind === 'graveyard' && face.flashbackCost !== null;
  // D537 - RETRACE / JUMP-START: the graveyard too, for the mana cost and a discard (the verb below charges it).
  const graveyardCast = from.kind === 'graveyard' && !flashback && !faceDown ? face.graveyardCast : null;
  // D417 - a PLAY PERMISSION: exile is a place to cast from while the player holds one for the card.
  const permitted = from.kind === 'exile' && state.playPermissions.some((p) => p.card === cardId && p.player === player);
  // D540 - a FORETOLD card: exile is a place to cast from for its owner once the turn it was foretold has ended
  // (CR 702.143a), for its foretell cost (`castsForetold`, the offer's own predicate).
  const foretold = from.kind === 'exile' && !faceDown && !free && castsForetold(state, cardId, face, player);
  // D551 - a PLOTTED card: exile is a place to cast from for its owner on a later turn - free, and as a sorcery.
  const plotted = !foretold && from.kind === 'exile' && !faceDown && !free && castsPlotted(state, cardId, player);
  // D541 - a MADNESS cast (CR 702.35a): the card its own discard exiled, cast by its owner as the trigger resolves - for
  // the madness cost, the timing and the priority the trigger's (a resolution asks; nobody holds priority).
  const madnessCast = madness && !faceDown && !free && from.kind === 'exile' && card.madnessExiled === true && card.owner === player && face.madnessCost !== null;
  if (madness && !madnessCast) return { error: reject('notCastable', `${face.name} cannot be cast for its madness cost now.`) };
  // D547 - a WARPED card: exile is a place to cast from for its owner on a turn after its warp exiled it, for its mana cost.
  const warped = from.kind === 'exile' && !faceDown && !free && castsWarped(state, cardId, player);
  if (from.kind !== 'hand' && from.kind !== 'command' && !flashback && graveyardCast === null && !permitted && !foretold && !madnessCast && !warped && !plotted) {
    return { error: reject('wrongZone', `${face.name} is not somewhere you can cast it from.`) };
  }
  if (from.player !== player && !permitted) return { error: reject('wrongZone', 'That is not your card.') };
  if (from.kind === 'command' && !card.isCommander) {
    return { error: reject('notCastable', 'Only a commander can be cast from the command zone.') };
  }
  if (!free && !madnessCast && (faceDown || plotted || !face.instantSpeed) && !canActAtSorcerySpeed(state, player)) {
    return {
      error: reject(
        'timingRestriction',
        `${face.name} is sorcery-speed — cast it in your own main phase with an empty stack.`,
      ),
    };
  }
  if (!free && !madnessCast && state.priority.player !== player) {
    return { error: reject('notYourPriority', 'You do not have priority.') };
  }
  // D312 - the generic reductions the board grants, folded into the tax the
  // way the offer folds them (a face-down cast has no printed text to reduce).
  // D491 - a granted cast has no mana cost to reduce and no tax.
  const tax = free || plotted
    ? 0
    : (from.kind === 'command' && card.isCommander ? 2 * card.commanderCastCount : 0) -
      (faceDown ? 0 : castReduction(state, deps.oracle, deps.scripts, player, face));
  const ward = wardTaxFor(state, deps, player, targets);
  // D408 - THE ALTERNATIVE COST elected: the mana cost is REPLACED by what the face's line names (its
  // mana, its life, its verb's picks, its pitch), under its condition; one alternative at a time (CR
  // 118.9: not beside a flashback or a face-down cast).
  const altCost = alternative ? alternativeCostProblem(state, deps, player, cardId, face, picks.exileFromHand) : null;
  if (altCost && 'error' in altCost) return altCost;
  // D547 - the warp cost is paid casting from the hand alone.
  if (altCost && face.alternativeCost?.keyword === 'warp' && from.kind !== 'hand') return { error: reject('notCastable', `${face.name}'s warp cost is paid only casting it from your hand.`) };
  if (altCost && (faceDown || flashback || foretold || madnessCast || plotted)) return { error: reject('notCastable', `${face.name}'s alternative cost cannot be paid with another alternative cost.`) };
  if (!altCost && picks.exileFromHand.length > 0) return { error: reject('notCastable', `${face.name} has no alternative cost the app charges.`) };
  // D307 - a flashback cast pays the FLASHBACK cost instead of the mana cost.
  // D540 - a foretold cast pays the FORETELL cost instead of the mana cost.
  // D541 - a madness cast pays the MADNESS cost instead of the mana cost.
  const cost = free || plotted ? null : altCost ? altCost.alt.mana : faceDown ? MORPH_CAST_COST : madnessCast ? face.madnessCost : foretold ? face.foretellCost : flashback && face.flashbackCost !== null ? face.flashbackCost : face.manaCost;
  if (cost === null && !altCost && !free && !plotted) return { error: reject('notCastable', `${face.name} cannot be cast.`) };
  // D403 - a kick is priced with the ward: the announcement names the count, the problem carries the cost.
  const kickWhy = faceDown ? (kicked > 0 || kickedWith0.length > 0 ? 'A face-down spell cannot be kicked.' : null) : kickProblem(face, kicked, kickedWith0);
  if (kickWhy) return { error: reject('notCastable', kickWhy) };
  // D530 - the named kickers of a two-kicker cast, normalised (empty for every other face).
  const kickedWith = !faceDown && face.kickerCost2 !== null && kicked > 0 ? kickersOf(kicked, kickedWith0) : [];
  // D535 - a buyback is priced with the kick: the announcement names it, the problem carries the cost.
  const buyWhy = buybackProblem(face, buyback, kicked, faceDown);
  if (buyWhy) return { error: reject('notCastable', buyWhy) };
  // D556 - a replicate count is priced with the kick: the announcement names it, the problem carries the cost that many times.
  const repWhy = replicateProblem(face, replicated, faceDown);
  if (repWhy) return { error: reject('notCastable', repWhy) };
  // D537 - a retrace or jump-start cast's discard rides the same verb path (never printed beside a verb kicker or buyback).
  const kickVerb = faceDown ? null : (kickVerbOf(face, kicked, buyback) ?? graveyardCast?.verb ?? null);
  // D405 - what the cast taps or exiles is checked by name and priced with the shared assignment.
  const altWhy = altProblem(state, deps, player, face, alt, faceDown);
  if (altWhy) return { error: reject('notCastable', altWhy) };
  // D406 - the additional cost's picks are checked against the offer's own lists; the life (or the
  // mana alternative) rides the problem, the picks are paid in the cost batch at completion.
  // With the alternative elected the picks pay ITS verb (an additional cost with a verb never prints beside one).
  const verbPicks: CastPicks = { ...picks, exileFromHand: [] };
  const addr = altCost ? { orPaid: false } : additionalCostProblem(state, deps, player, cardId, face, verbPicks, kickVerb);
  if ('error' in addr) return addr;
  const altr = altCost ? costPicksProblem(state, deps, player, cardId, face.name, altCost.alt, verbPicks) : { orPaid: false };
  if ('error' in altr) return altr;
  const extras0 = additionalExtras(face, addr.orPaid, kickVerb);
  const extras = { mana: extras0.mana, life: extras0.life + (altCost ? altCost.alt.lifeCost : 0) };
  const base = buildPaymentProblem(cost, xValue, [...ward.mana, ...kickerMana(face, kicked, kickedWith), ...buybackMana(face, buyback), ...replicateMana(face, replicated), ...extras.mana], tax, ward.life + extras.life);
  const priced = priceAlternatives(state, deps, face, base, alt);
  if ('error' in priced) return priced;
  const problem = priced.problem;
  // A face-down spell has no color identity to show (CR 708.2).
  return { problem, face, tax, from, identity: faceDown ? [] : oracleCard.colorIdentity, faceDown, kicked, kickedWith, buyback, replicated, alt, picks, orPaid: addr.orPaid, alternative: altCost !== null, ...(free || plotted ? { free: true as const } : {}), ...(foretold && card.foretoldTurn !== undefined ? { foretold: card.foretoldTurn } : {}), ...(plotted && card.plottedTurn !== undefined ? { plotted: card.plottedTurn } : {}), ...(madnessCast ? { madness: true as const } : {}) };
}

// D309 - THE MORPH SEAM: turning a face-down permanent face up is a special
// action (CR 702.37c, 708.7): any time you have priority, pay the morph cost
// and it turns face up - no stack, nothing to respond to. A megamorph adds a
// +1/+1 counter as it turns (CR 702.37e). The payment is the same staged plan a
// cast pays with, checked by the same validator.
/**
 * D489 - SUSPEND (CR 702.62a): a special action from the hand, taken any time the card could be cast (the timing, not
 * the mana - a sorcery-speed card on the player's own main phase with an empty stack, an instant any time they hold
 * priority): the suspend cost is paid as the morph cost is (D309 - a plan, or the solver's), and the card goes to
 * exile with N time counters and the mark the upkeep tick reads. The tick is a delayed trigger armed for the owner's
 * next upkeep (D402's shape) carrying one `suspendTick` clause; it re-arms itself while counters remain.
 */
function suspend(state: GameState, intent: Extract<Intent, { t: 'Suspend' }>, deps: EngineDeps): HandleResult {
  const card = state.cards[intent.card];
  if (!card) return reject('noSuchCard', 'That card is not in the game.');
  if (card.zone.kind !== 'hand' || card.zone.player !== intent.player) return reject('wrongZone', 'That card is not in your hand.');
  const oracleCard = deps.oracle.byPrinting(card.printingId);
  if (!oracleCard) return reject('noSuchCard', 'That card is not in the card database.');
  const face = faceOf(oracleCard, 0);
  if (face.suspend === null) return reject('notCastable', `${face.name} has no suspend cost.`);
  if (state.priority.player !== intent.player || state.priority.awaiting !== null) {
    return reject('notYourPriority', 'You do not have priority.');
  }
  if (state.pendingCast) return reject('wrongCastStage', 'Finish or cancel the spell you are already casting.');
  if (!face.instantSpeed && !canActAtSorcerySpeed(state, intent.player)) {
    return reject('notCastable', `${face.name} could not be cast now, so it cannot be suspended now.`);
  }
  const problem = buildPaymentProblem(face.suspend.cost, 0, [], 0);
  const solve = solveInputFor(state, deps.oracle, deps.scripts, intent.player);
  // D397 - a special action (CR 702.62a), neither a spell nor an ability: restricted mana never pays it.
  const chosen = intent.plan ?? suggestPayment(solve, problem, OTHER_PURPOSE);
  if (!chosen) return reject('cannotAfford', `You cannot pay ${face.suspend.cost.raw} to suspend ${face.name}.`);
  const verdict = validatePlan(state, deps.oracle, deps.scripts, intent.player, problem, chosen, OTHER_PURPOSE);
  if (verdict === 'stale') return reject('stalePaymentPlan', 'The board changed while you were paying. Try again.');
  if (verdict === 'invalid') return reject('invalidPaymentPlan', 'That payment does not cover the cost.');
  const events: EventBody[] = [];
  events.push(
    ...payEvents(state, deps, intent.player, chosen, {
      problem,
      face,
      tax: 0,
      from: { kind: 'hand', player: intent.player },
      identity: oracleCard.colorIdentity,
    }, OTHER_PURPOSE),
  );
  events.push({ t: 'CardsMoved', moves: [{ card: intent.card, from: { kind: 'hand', player: intent.player }, to: { kind: 'exile', player: card.owner }, suspend: true }] });
  events.push({ t: 'CountersChanged', changes: [{ card: intent.card, kind: 'time', delta: face.suspend.count }] });
  events.push({ t: 'DelayedTriggerArmed', trigger: suspendTick(state, intent.card, card.owner, face.name) });
  events.push(
    narrated(
      n`${who(state, intent.player)} ${vb(intent.player, 'suspends', 'suspend')} ${face.name} with ${String(face.suspend.count)} time counters.`,
      intent.player,
      oracleCard.colorIdentity,
    ),
  );
  events.push(...retainPriority(intent.player, state.stack.length));
  return accept(events);
}

/**
 * D540 - FORETELL (CR 702.143a): a special action from the hand, any time the player holds priority during their OWN
 * turn (a spell on the stack is no bar - the card's own timing is the cast's, not this): {2} paid as suspend's cost is
 * (D489 - a plan, or the solver's), and the card goes to exile FACE DOWN, marked with the turn. Its owner may look at
 * it (`project.ts`); the table learns only that a card was foretold - the narration names none and shows no colour.
 * Once that turn has ended the card may be cast from exile for its foretell cost (`prepareCast`, `castsForetold`).
 */
/**
 * D551 - PLOT (CR 702.170a): a special action from the hand at sorcery speed - the plot cost paid (a plan, or the
 * solver's; restricted mana never pays a special action, D397), the card exiled FACE UP and marked with this turn. No
 * stack; on a later turn it is cast from exile free, as a sorcery (`castsPlotted`).
 */
function plot(state: GameState, intent: Extract<Intent, { t: 'Plot' }>, deps: EngineDeps): HandleResult {
  const card = state.cards[intent.card];
  if (!card) return reject('noSuchCard', 'That card is not in the game.');
  if (card.zone.kind !== 'hand' || card.zone.player !== intent.player) return reject('wrongZone', 'That card is not in your hand.');
  const oracleCard = deps.oracle.byPrinting(card.printingId);
  if (!oracleCard) return reject('noSuchCard', 'That card is not in the card database.');
  const face = faceOf(oracleCard, 0);
  if (face.plotCost === null || face.isLand) return reject('notCastable', `${face.name} has no plot cost.`);
  if (state.priority.player !== intent.player || state.priority.awaiting !== null) {
    return reject('notYourPriority', 'You do not have priority.');
  }
  if (!canActAtSorcerySpeed(state, intent.player)) return reject('timingRestriction', 'A card is plotted only as a sorcery - in your own main phase with an empty stack.');
  if (state.pendingCast) return reject('wrongCastStage', 'Finish or cancel the spell you are already casting.');
  const problem = buildPaymentProblem(face.plotCost, 0, [], 0);
  const solve = solveInputFor(state, deps.oracle, deps.scripts, intent.player);
  const chosen = intent.plan ?? suggestPayment(solve, problem, OTHER_PURPOSE);
  if (!chosen) return reject('cannotAfford', `You cannot pay ${face.plotCost.raw} to plot ${face.name}.`);
  const verdict = validatePlan(state, deps.oracle, deps.scripts, intent.player, problem, chosen, OTHER_PURPOSE);
  if (verdict === 'stale') return reject('stalePaymentPlan', 'The board changed while you were paying. Try again.');
  if (verdict === 'invalid') return reject('invalidPaymentPlan', 'That payment does not cover the cost.');
  const events: EventBody[] = [];
  events.push(...payEvents(state, deps, intent.player, chosen, { problem }, OTHER_PURPOSE));
  events.push({ t: 'CardsMoved', moves: [{ card: intent.card, from: { kind: 'hand', player: intent.player }, to: { kind: 'exile', player: card.owner }, plottedTurn: state.turn.turnNumber }] });
  events.push(narrated(n`${who(state, intent.player)} ${vb(intent.player, 'plots', 'plot')} ${face.name}.`, intent.player, oracleCard.colorIdentity));
  events.push(...retainPriority(intent.player, state.stack.length));
  return accept(events);
}

function foretell(state: GameState, intent: Extract<Intent, { t: 'Foretell' }>, deps: EngineDeps): HandleResult {
  const card = state.cards[intent.card];
  if (!card) return reject('noSuchCard', 'That card is not in the game.');
  if (card.zone.kind !== 'hand' || card.zone.player !== intent.player) return reject('wrongZone', 'That card is not in your hand.');
  const oracleCard = deps.oracle.byPrinting(card.printingId);
  if (!oracleCard) return reject('noSuchCard', 'That card is not in the card database.');
  const face = faceOf(oracleCard, 0);
  if (face.foretellCost === null || face.isLand) return reject('notCastable', `${face.name} has no foretell cost.`);
  if (state.priority.player !== intent.player || state.priority.awaiting !== null) {
    return reject('notYourPriority', 'You do not have priority.');
  }
  if (state.turn.activePlayer !== intent.player) return reject('timingRestriction', "A card is foretold only during its owner's own turn.");
  if (state.pendingCast) return reject('wrongCastStage', 'Finish or cancel the spell you are already casting.');
  const problem = buildPaymentProblem(FORETELL_COST, 0, [], 0);
  const solve = solveInputFor(state, deps.oracle, deps.scripts, intent.player);
  // D397 - a special action (CR 116.2h), neither a spell nor an ability: restricted mana never pays it.
  const chosen = intent.plan ?? suggestPayment(solve, problem, OTHER_PURPOSE);
  if (!chosen) return reject('cannotAfford', `You cannot pay {2} to foretell ${face.name}.`);
  const verdict = validatePlan(state, deps.oracle, deps.scripts, intent.player, problem, chosen, OTHER_PURPOSE);
  if (verdict === 'stale') return reject('stalePaymentPlan', 'The board changed while you were paying. Try again.');
  if (verdict === 'invalid') return reject('invalidPaymentPlan', 'That payment does not cover the cost.');
  const events: EventBody[] = [];
  events.push(...payEvents(state, deps, intent.player, chosen, { problem }, OTHER_PURPOSE));
  events.push({ t: 'CardsMoved', moves: [{ card: intent.card, from: { kind: 'hand', player: intent.player }, to: { kind: 'exile', player: card.owner }, faceDown: true, foretoldTurn: state.turn.turnNumber }] });
  // The table learns that a card was foretold, never which: no name, no colour.
  events.push(narrated(n`${who(state, intent.player)} ${vb(intent.player, 'foretells', 'foretell')} a card.`, intent.player, []));
  events.push(...retainPriority(intent.player, state.stack.length));
  return accept(events);
}

function turnFaceUp(state: GameState, intent: Extract<Intent, { t: 'TurnFaceUp' }>, deps: EngineDeps): HandleResult {
  const card = state.cards[intent.card];
  if (!card) return reject('noSuchCard', 'That card is not in the game.');
  if (card.zone.kind !== 'battlefield' || card.controller !== intent.player) {
    return reject('wrongZone', 'That is not a permanent you control.');
  }
  if (!card.faceDown) return reject('notCastable', 'That permanent is already face up.');
  const oracleCard = deps.oracle.byPrinting(card.printingId);
  if (!oracleCard) return reject('noSuchCard', 'That card is not in the card database.');
  const face = faceOf(oracleCard, card.faceIndex);
  // D526 - a MANIFESTED creature card turns face up for its mana cost (CR 701.34c); a morph cost serves too (702.37).
  const flipCost = face.morphCost ?? (card.manifested === true && face.typeLine.types.includes('Creature') ? face.manaCost : null);
  if (flipCost === null) return reject('notCastable', `${face.name} has no cost the engine can charge to turn it face up.`);
  if (state.priority.player !== intent.player || state.priority.awaiting !== null) {
    return reject('notYourPriority', 'You do not have priority.');
  }
  if (state.pendingCast) return reject('wrongCastStage', 'Finish or cancel the spell you are already casting.');
  const problem = buildPaymentProblem(flipCost, 0, [], 0);
  const solve = solveInputFor(state, deps.oracle, deps.scripts, intent.player);
  // D397 - a special action (CR 708.7), neither a spell nor an ability: restricted mana never pays it.
  const chosen = intent.plan ?? suggestPayment(solve, problem, OTHER_PURPOSE);
  if (!chosen) return reject('cannotAfford', `You cannot pay ${face.morphCost !== null ? (face.morphCostText ?? 'the morph cost') : (face.manaCost?.raw ?? 'the mana cost')} to turn ${face.name} face up.`);
  const verdict = validatePlan(state, deps.oracle, deps.scripts, intent.player, problem, chosen, OTHER_PURPOSE);
  if (verdict === 'stale') return reject('stalePaymentPlan', 'The board changed while you were paying. Try again.');
  if (verdict === 'invalid') return reject('invalidPaymentPlan', 'That payment does not cover the cost.');
  const events: EventBody[] = [];
  events.push(
    ...payEvents(state, deps, intent.player, chosen, {
      problem,
      face,
      tax: 0,
      from: { kind: 'battlefield', player: intent.player },
      identity: oracleCard.colorIdentity,
    }, OTHER_PURPOSE),
  );
  events.push({ t: 'FaceDownSet', card: intent.card, faceDown: false });
  // D526 - the megamorph counter is the MORPH cost's (CR 702.37a): a manifested card flipped for its mana cost gets none.
  if (face.megamorph && face.morphCost !== null && flipCost === face.morphCost) events.push({ t: 'CountersChanged', changes: [{ card: intent.card, kind: '+1/+1', delta: 1 }] });
  events.push(
    narrated(
      n`${who(state, intent.player)} ${vb(intent.player, 'turns', 'turn')} ${face.name} face up.`,
      intent.player,
      oracleCard.colorIdentity,
    ),
  );
  events.push(...retainPriority(intent.player, state.stack.length));
  return accept(events);
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
    intent.faceDown === true,
    intent.kicked ?? 0,
    { convoke: intent.convoke ?? [], improvise: intent.improvise ?? [], delve: intent.delve ?? [] },
    picksOf(intent),
    intent.alternative === true,
    false,
    intent.kickedWith ?? [],
    intent.buyback === true,
    false,
    intent.replicated ?? 0,
  );
  if ('error' in setup) return setup.error;

  // ⚠️ ORDER IS CR 601.2b THEN 601.2c: X is announced before targets are chosen.
  // It matters — ~172 cards read `X target creatures`, where the number of
  // targets IS X, and asking for targets first makes those cards unaskable.
  // `PendingCast` lives in GAME STATE, which is what makes "Bob dropped while
  // choosing" recoverable rather than fatal.
  // D343 - CR 601.2b: a MODAL spell's modes are chosen FIRST, before X and
  // before targets, and the chosen modes' clauses are then what the spell
  // aims. Named inline they are checked here (the host decides legality);
  // absent, the `modes` stage asks. A face-down cast has no modes (CR 708.2).
  const modal = setup.faceDown ? null : setup.face.modal;
  const needsModes = modal !== null && intent.modes === undefined;
  if (modal !== null && intent.modes !== undefined) {
    const legal = legalModesFor(state, deps, intent.player, intent.card, modal.modes);
    const problem = modeChoiceProblem(modal.modes.length, modal.min, modal.max, legal, intent.modes);
    if (problem) return reject('illegalMode', problem);
  }
  if (needsModes && modal !== null && legalModesFor(state, deps, intent.player, intent.card, modal.modes).length < modal.min) {
    return reject('illegalMode', `No mode of ${setup.face.name} has a legal target right now.`);
  }
  const chosenModes = modal !== null && intent.modes !== undefined ? modesInOrder(intent.modes) : [];
  // D548 - an awakened cast aims the awakened land after the printed clauses (`castTargetSpecs`).
  const spellSpecs = modal !== null ? modeSpecs(modal.modes, chosenModes) : castTargetSpecs(setup.face, intent.alternative === true);
  const needsX = !setup.faceDown && !!setup.face.manaCost && setup.face.manaCost.xCount > 0 && intent.xValue === undefined;
  const needsTargets = !setup.faceDown && spellSpecs.length > 0 && intent.targets === undefined;

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
  // D299: the clause each pick answers, fixed here and carried onto the spell.
  let targetSlots: readonly number[] | undefined;
  if (!setup.faceDown && intent.targets !== undefined && spellSpecs.length > 0) {
    const verdict = validateTargets(
      spellSpecs,
      { controller: intent.player, colors: setup.face.colors },
      setup.face.name,
      intent.targets,
      candidatesFromState(state, deps),
    );
    if (!verdict.ok) return reject('illegalTarget', verdict.message);
    targetSlots = verdict.assignment;
  }

  if (needsModes || needsX || needsTargets) {
    const stackId = `s${state.counters.stack + 1}`;
    const pending: PendingCast = {
      player: intent.player,
      card: intent.card,
      from: setup.from,
      stackId,
      stage: needsModes ? 'modes' : needsX ? 'x' : 'targets',
      kind: 'spell',
      faceIndex,
      abilityRef: null,
      modes: chosenModes,
      targets: intent.targets ?? [],
      ...(targetSlots !== undefined ? { targetSlots } : {}),
      xValue: intent.xValue ?? null,
      problem: setup.problem,
      paidSoFar: EMPTY_POOL,
      lifePaid: 0,
      isCommanderCast: setup.from.kind === 'command',
      taxApplied: setup.tax,
      ...(setup.kicked > 0 ? { kicked: setup.kicked } : {}),
      ...(setup.kickedWith.length > 0 ? { kickedWith: setup.kickedWith } : {}),
      ...(setup.buyback ? { buyback: true as const } : {}),
      ...(setup.replicated > 0 ? { replicated: setup.replicated } : {}),
      ...(setup.foretold !== undefined ? { foretold: setup.foretold } : {}),
      // D551 - a PLOTTED cast is free: its staged stages price nothing (the only free setup this path makes), and a
      // back-out restores the mark.
      ...(setup.free ? { free: true as const } : {}),
      ...(setup.plotted !== undefined ? { plotted: setup.plotted } : {}),
      ...(altCount(setup.alt) > 0 ? { alt: setup.alt } : {}),
      ...(setup.picks.sacrifice.length > 0 ? { sacrifice: setup.picks.sacrifice } : {}),
      ...(setup.picks.discard.length > 0 ? { discard: setup.picks.discard } : {}),
      ...(setup.picks.tap.length > 0 ? { tap: setup.picks.tap } : {}),
      ...(setup.picks.exileFromGraveyard.length > 0 ? { exileFromGraveyard: setup.picks.exileFromGraveyard } : {}),
      ...(setup.picks.returnToHand.length > 0 ? { returnToHand: setup.picks.returnToHand } : {}),
      ...(setup.orPaid ? { orPaid: true as const } : {}),
      ...(setup.alternative ? { alternative: true as const } : {}),
      ...(setup.picks.exileFromHand.length > 0 ? { exileFromHand: setup.picks.exileFromHand } : {}),
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
        awaiting:
          needsModes && modal !== null
            ? modesAwaiting(
                intent.player,
                stackId,
                intent.card,
                setup.face.name,
                modal.modes,
                modal,
                legalModesFor(state, deps, intent.player, intent.card, modal.modes),
                'spell',
              )
            : needsX
              ? { kind: 'chooseX', player: intent.player, stackId, source: intent.card, label: setup.face.name }
              : targetsAwaiting(intent.player, stackId, intent.card, setup.face.name, spellSpecs, 'spell'),
      },
    ]);
  }

  return completeCast(state, deps, {
    player: intent.player,
    card: intent.card,
    faceIndex,
    xValue: intent.xValue ?? 0,
    targets: intent.targets ?? [],
    ...(targetSlots !== undefined ? { targetSlots } : {}),
    ...(modal !== null ? { modes: chosenModes } : {}),
    ...(intent.plan !== undefined ? { plan: intent.plan } : {}),
    setup,
  });
}

/**
 * D491 - THE FROM-HAND FREE CAST: a cast BEGUN BY AN ANSWER (`chooseFromZone` with `castFree`), not by a `CastSpell`
 * intent. The granting spell is resolving and nobody holds priority, so the timing is the grant's (CR 601.2 under
 * "you may cast"); the announcement's own questions still follow in their order (CR 601.2b/c - the modes, then the
 * targets; X is 0 when a spell is cast without paying its mana cost, CR 107.3?/601.2b - so the X stage never
 * asks), and the cast completes with nothing paid but the ward and the additional cost's price. The granting
 * effect's remaining clauses ride the pending cast as its continuation (D484's shape) and run when the cast
 * completes or is backed out of. The stack object carries `freeCast`.
 */
// D541 - and the MADNESS cast (`madness`): begun the same way by the madness trigger's answer, for the madness cost -
// priced (the board's reductions carried as the tax), paid after the announcement by the solver's plan.
function beginGrantedCast(state: GameState, deps: EngineDeps, player: PlayerId, cardId: InstanceId, continuation: EffectContinuation | undefined, madness = false): HandleResult {
  if (state.pendingCast) return reject('wrongCastStage', 'Finish or cancel the spell you are already casting.');
  const setup = prepareCast(state, deps, player, cardId, 0, 0, [], false, 0, NO_ALT, NO_PICKS, false, !madness, [], false, madness);
  if ('error' in setup) return setup.error;
  const modal = setup.face.modal;
  const spellSpecs = modal !== null ? [] : setup.face.targets;
  const needsModes = modal !== null;
  const needsTargets = spellSpecs.length > 0;
  const xValue = setup.face.manaCost !== null && setup.face.manaCost.xCount > 0 ? 0 : null;
  if (modal !== null && legalModesFor(state, deps, player, cardId, modal.modes).length < modal.min) {
    return reject('illegalMode', `No mode of ${setup.face.name} has a legal target right now.`);
  }
  if (needsModes || needsTargets) {
    const stackId = `s${state.counters.stack + 1}`;
    const pending: PendingCast = {
      player,
      card: cardId,
      from: setup.from,
      stackId,
      stage: needsModes ? 'modes' : 'targets',
      kind: 'spell',
      faceIndex: 0,
      abilityRef: null,
      modes: [],
      targets: [],
      xValue,
      problem: setup.problem,
      paidSoFar: EMPTY_POOL,
      lifePaid: 0,
      isCommanderCast: false,
      // D541 - a madness cast carries the board's reductions its problem was priced with (a free cast has none).
      taxApplied: madness ? setup.tax : 0,
      ...(setup.orPaid ? { orPaid: true as const } : {}),
      ...(madness ? { madness: true as const } : { free: true as const }),
      ...(continuation !== undefined ? { continuation } : {}),
    };
    return accept([
      { t: 'CardsMoved', moves: [{ card: cardId, from: setup.from, to: { kind: 'stack', player: null } }] },
      { t: 'CastBegan', pending },
      {
        t: 'AwaitingSet',
        awaiting:
          modal !== null
            ? modesAwaiting(player, stackId, cardId, setup.face.name, modal.modes, modal, legalModesFor(state, deps, player, cardId, modal.modes), 'spell')
            : targetsAwaiting(player, stackId, cardId, setup.face.name, spellSpecs, 'spell'),
      },
    ]);
  }
  return completeCast(state, deps, {
    player,
    card: cardId,
    faceIndex: 0,
    xValue: 0,
    targets: [],
    setup,
    lead: [{ t: 'AwaitingSet', awaiting: null }],
    ...(continuation !== undefined ? { continuation } : {}),
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
  // D403 - the kick announced with the cast stays in the problem X resizes.
  const xExtras = additionalExtras(face, pending.orPaid === true, kickVerbOf(face, pending.kicked ?? 0, pending.buyback === true));
  // D437 - a flashback cast keeps paying its FLASHBACK cost when X resizes the problem (D307): the printed cost was
  // priced here before, and a Devil's Play flashed back for {X}{R}{R}{R} became {X}{R} the moment X was named.
  // D535 - and every other cost the cast chose (`stagedCastCost`).
  const xCost = stagedCastCost(face, pending);
  const base = buildPaymentProblem(xCost, intent.x, [...kickerMana(face, pending.kicked ?? 0, pending.kickedWith ?? []), ...buybackMana(face, pending.buyback === true), ...replicateMana(face, pending.replicated ?? 0), ...xExtras.mana], pending.taxApplied, xExtras.life + stagedCastLife(face, pending));
  // D405 - the alternatives the cast named stay in the problem X resizes (a choice X leaves no symbol for is refused).
  const priced = priceAlternatives(state, deps, face, base, pending.alt ?? NO_ALT);
  if ('error' in priced) return priced.error;
  const problem = priced.problem;

  // CR 601.2c follows 601.2b: with X known, ask for the targets it may size.
  // D343 - a modal spell aims the CHOSEN modes' clauses.
  const xSpecs = face.modal ? modeSpecs(face.modal.modes, pending.modes) : castTargetSpecs(face, pending.alternative === true);
  if (xSpecs.length > 0 && pending.targets.length === 0) {
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
          xSpecs,
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
  // D367 - a GRANTED ability is read off the recipient's DERIVED object, which is
  // where a grant exists: a stale intent for an Aura that has since left finds
  // nothing and is refused here, before any cost. The ref the activation writes
  // is the grant's, so `activatedDefFor` resolves the provider's def at
  // resolution with this permanent as the source (CR 113.7a).
  const grant = intent.grantRef !== undefined
    ? derive(state, deps.oracle, deps.scripts, intent.card).grantedActivated.find((g) => g.ref === intent.grantRef)
    : undefined;
  if (intent.grantRef !== undefined && !grant) return reject('notCastable', `${face.name} no longer has that granted ability.`);
  const ability = grant ? grant.ability : face.activated[intent.abilityIndex];
  if (!ability) return reject('notCastable', 'That permanent has no such ability.');
  // D552 - DETAIN (CR 701.35a): a detained permanent's activated abilities can't be activated.
  if (isDetained(state, intent.card)) return reject('notCastable', `${face.name} is detained - its abilities can't be activated until its detainer's next turn.`);
  // D550 - SPLIT SECOND (CR 702.61a): no ability but a mana ability is activated while such a spell is on the stack.
  if (!ability.isManaAbility && splitSecondOnStack(state, deps.oracle)) {
    return reject('timingRestriction', 'A spell with split second is on the stack - only mana abilities can be activated until it resolves.');
  }
  const abilityRef: AbilityRef = grant ? grant.ref : `${oracleCard.oracleId}#a${intent.abilityIndex}`;
  // A printed ability's destructive cost is offered only past a registered def
  // (D159); a granted ability EXISTS only because a def installed it.
  // D462 - a synthesized ninjutsu resolves natively: its return is the engine's own to charge.
  const defReady = grant !== undefined || ability.ninjutsu !== undefined || activatedDefRegistered(deps.scripts, oracleCard.oracleId, intent.abilityIndex);
  // D306 - cycling is activated from the hand and nowhere else (CR 702.29a).
  if (ability.cycling !== undefined && (card.zone.kind !== 'hand' || card.zone.player !== intent.player)) {
    return reject('wrongZone', 'Cycling is activated from your hand.');
  }
  // D451 - an ability priced by discarding the card is activated from the hand (CR 113.6 - bloodrush, reinforce).
  if (ability.discardsSelf === true && (card.zone.kind !== 'hand' || card.zone.player !== intent.player)) {
    return reject('wrongZone', `${face.name}'s ability is activated from your hand.`);
  }
  if (ability.discardsSelf === true && ability.reinforce === undefined && !defReady) {
    return reject('notCastable', `${face.name}'s "${ability.costText}" ability is not one the app runs yet.`);
  }
  // D329 - an ability priced by exiling the card from the graveyard is activated from there (CR 113.6).
  if ((ability.exileSelfFromGraveyard || ability.activatesFromGraveyard) && (card.zone.kind !== 'graveyard' || card.zone.player !== intent.player)) {
    return reject('wrongZone', `${face.name}'s ability is activated from your graveyard.`);
  }
  // D342 - every other activated ability of a permanent is activated from the
  // BATTLEFIELD (CR 602.2). `legal.ts` never offered one from elsewhere, but the
  // handler required a zone only for cycling and the graveyard activations, so a
  // hand-built intent on a card in a graveyard went straight to payment - the D342
  // port's own proof activated a sacrificed land from its graveyard.
  // D462 - ninjutsu is activated from the hand (CR 702.49a), inside the combat window (blockers declared, combat not over).
  if (ability.ninjutsu !== undefined && (card.zone.kind !== 'hand' || card.zone.player !== intent.player)) {
    return reject('wrongZone', `${face.name}'s ninjutsu is activated from your hand.`);
  }
  if (ability.ninjutsu !== undefined && (state.combat === null || !NINJUTSU_STEPS.has(state.turn.step))) {
    return reject('timingRestriction', `${face.name}'s ninjutsu can be activated only after blockers are declared, while combat lasts.`);
  }
  if (ability.cycling === undefined && ability.discardsSelf !== true && ability.ninjutsu === undefined && !ability.exileSelfFromGraveyard && !ability.activatesFromGraveyard && card.zone.kind !== 'battlefield') {
    return reject('wrongZone', `${face.name} is not on the battlefield.`);
  }
  // D328 - CR 602.5b: "Activate only once each turn" is refused the second
  // time this turn (`legal.ts` stops offering it the same way).
  if (ability.oncePerTurn && (state.turn.activations[`${intent.card}|${abilityRef}`] ?? 0) >= 1) {
    return reject('timingRestriction', `${face.name}'s "${ability.costText}" ability was activated this turn already.`);
  }
  // D472 - CR 606.3 / 606.5: one loyalty ability per permanent per turn, and a negative cost only with the
  // counters to pay it (`legal.ts` offers by the same two rules; the sorcery timing is checked with `sorceryOnly`).
  if (ability.loyaltyCost !== undefined) {
    if ((state.turn.activations[`${intent.card}|loyalty`] ?? 0) >= 1) {
      return reject('timingRestriction', `${face.name} has activated a loyalty ability this turn already.`);
    }
    if (ability.loyaltyCost < 0 && (card.counters['loyalty'] ?? 0) + ability.loyaltyCost < 0) {
      return reject('cannotAfford', `${face.name} has too few loyalty counters for "${ability.costText}".`);
    }
  }
  // D457 - CR 702.178: an exhaust ability this object has activated is refused for good (`legal.ts` stops offering it).
  if (ability.exhaust && (card.exhausted ?? []).includes(abilityRef)) {
    return reject('timingRestriction', `${face.name}'s "${ability.costText}" ability has been activated already (exhaust).`);
  }
  // D458 - CR 702.142: a boast is refused unless this creature attacked this turn (the once-each-turn half is above).
  if (ability.boast && !state.turn.memory.attackerIds.includes(intent.card)) {
    return reject('timingRestriction', `${face.name}'s "${ability.costText}" ability can be activated only if it attacked this turn (boast).`);
  }
  // D342 - "Activate only <condition>": every condition the parser read must hold
  // now (`legal.ts` offers the ability the same way); CR 602.5b-d.
  if (ability.activateOnly.length > 0 && !activationConditionsHold(state, deps.oracle, deps.scripts, intent.player, intent.card, ability.activateOnly)) {
    return reject('timingRestriction', `${face.name}'s "${ability.costText}" ability can be activated only ${describeActivationConditions(ability.activateOnly)}.`);
  }
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
  if (ability.sacrificesSelf && !defReady) {
    return reject('notCastable', `${face.name}'s "${ability.costText}" cost is not one the app can pay — use the manual tools.`);
  }
  // ⚠️ The CHOOSER cost (D168): the def gate, then the CHOICE — required,
  // and re-validated with the same predicate `legal.ts` offered by, because
  // a client's word is not a rule (D139's shape, a third intent over).
  if (ability.sacrificeCost) {
    if (!defReady) {
      return reject('notCastable', `${face.name}'s "${ability.costText}" cost is not one the app can pay — use the manual tools.`);
    }
    // D353 - EXACTLY `count` DISTINCT permanents, the discard chooser's rule (D286): a
    // repeated id has length 2 and eats one permanent, which would charge half the cost.
    const picks = intent.sacrifice ?? [];
    const want = ability.sacrificeCost.count;
    if (picks.length !== want) {
      return reject('needsSacrifice', `${face.name}'s cost sacrifices ${want} permanent${want === 1 ? '' : 's'} — say which.`);
    }
    if (new Set(picks).size !== picks.length) return reject('noSuchCard', 'You named the same permanent twice.');
    const legalSacs = sacrificeCandidatesFor(
      state,
      (cid: InstanceId) => derive(state, deps.oracle, deps.scripts, cid),
      intent.player,
      intent.card,
      ability.sacrificeCost,
    );
    if (!picks.every((c) => legalSacs.includes(c))) {
      return reject('illegalSacrifice', `Those permanents cannot pay ${face.name}'s "${ability.costText}" cost.`);
    }
  }
  // ⚠️ The DISCARD chooser (D286): the def gate, then the CHOICE — exactly
  // `count` distinct hand cards, re-validated against the list `legal.ts`
  // offered by (a client's word is not a rule, D139).
  if (ability.discardCost) {
    if (!defReady) {
      return reject('notCastable', `${face.name}'s "${ability.costText}" cost is not one the app can pay — use the manual tools.`);
    }
  }
  // D328 - a random discard names no card: the hand must hold enough, and
  // `finishAbility` draws them off the seeded rng when the cost is paid.
  if (ability.discardCost?.atRandom && (state.zones.hand[intent.player] ?? []).length < ability.discardCost.count) {
    return reject('cannotAfford', `You cannot pay ${ability.costText} for ${face.name}.`);
  }
  if (ability.discardCost && !ability.discardCost.atRandom) {
    const picks = intent.discard ?? [];
    const want = ability.discardCost.count;
    if (picks.length !== want) {
      return reject('needsDiscard', `${face.name}'s cost discards ${want} card${want === 1 ? '' : 's'} — say which.`);
    }
    if (new Set(picks).size !== picks.length) return reject('noSuchCard', 'You named the same card twice.');
    const legalDiscards = discardCandidatesFor(
      state,
      (cid: InstanceId) => derive(state, deps.oracle, deps.scripts, cid),
      intent.player,
      ability.discardCost,
    );
    if (!picks.every((c) => legalDiscards.includes(c))) {
      return reject('illegalDiscard', `Those cards cannot pay ${face.name}'s "${ability.costText}" cost.`);
    }
  }
  // D329 - the EXILE-FROM-GRAVEYARD chooser: the def gate, then exactly
  // `count` distinct graveyard cards, re-validated against the offered list.
  if (ability.exileFromGraveyardCost) {
    if (!defReady) {
      return reject('notCastable', `${face.name}'s "${ability.costText}" cost is not one the app can pay — use the manual tools.`);
    }
    const picks = intent.exileFromGraveyard ?? [];
    const want = ability.exileFromGraveyardCost.count;
    if (picks.length !== want) {
      return reject('needsExileFromGraveyard', `${face.name}'s cost exiles ${want} card${want === 1 ? '' : 's'} from your graveyard — say which.`);
    }
    if (new Set(picks).size !== picks.length) return reject('noSuchCard', 'You named the same card twice.');
    const legalExiles = exileFromGraveyardCandidatesFor(
      state,
      (cid: InstanceId) => derive(state, deps.oracle, deps.scripts, cid),
      intent.player,
      intent.card,
      ability.exileFromGraveyardCost,
    );
    if (!picks.every((c) => legalExiles.includes(c))) {
      return reject('illegalExileFromGraveyard', `Those cards cannot pay ${face.name}'s "${ability.costText}" cost.`);
    }
  }
  // ⚠️ The TAP chooser (D286): the same gate and the same re-validation,
  // over untapped permanents the player controls.
  if (ability.tapCost) {
    // D553 - saddle's effect is the engine's own too.
    if (ability.crew === undefined && ability.saddle === undefined && !defReady) {
      return reject('notCastable', `${face.name}'s "${ability.costText}" cost is not one the app can pay — use the manual tools.`);
    }
    const picks = intent.tap ?? [];
    const want = ability.tapCost.count;
    if (ability.tapCost.powerAtLeast !== undefined) {
      // D311 - crew: any number of the candidates, their power adding up to N.
      const power = picks.reduce((sum, c) => sum + (derive(state, deps.oracle, deps.scripts, c).power ?? 0), 0);
      if (picks.length === 0 || power < ability.tapCost.powerAtLeast) {
        return reject('needsTap', `${face.name}'s crew taps untapped creatures you control with total power ${ability.tapCost.powerAtLeast} or more — say which.`);
      }
    } else if (picks.length !== want) {
      return reject('needsTap', `${face.name}'s cost taps ${want} untapped permanent${want === 1 ? '' : 's'} you control — say which.`);
    }
    if (new Set(picks).size !== picks.length) return reject('noSuchCard', 'You named the same permanent twice.');
    const legalTaps = tapCandidatesFor(
      state,
      (cid: InstanceId) => derive(state, deps.oracle, deps.scripts, cid),
      intent.player,
      intent.card,
      ability.tapCost,
    );
    if (!picks.every((c) => legalTaps.includes(c))) {
      return reject('illegalTap', `Those permanents cannot pay ${face.name}'s "${ability.costText}" cost.`);
    }
  }
  // D352 - THE RETURN chooser and the SELF return: the same gate and the same
  // re-validation, over permanents the player controls.
  if (ability.returnsSelf && !defReady) {
    return reject('notCastable', `${face.name}'s "${ability.costText}" cost is not one the app can pay — use the manual tools.`);
  }
  if (ability.returnCost) {
    if (!defReady) {
      return reject('notCastable', `${face.name}'s "${ability.costText}" cost is not one the app can pay — use the manual tools.`);
    }
    const picks = intent.returnToHand ?? [];
    const want = ability.returnCost.count;
    if (picks.length !== want) {
      return reject('needsReturn', `${face.name}'s cost returns ${want} permanent${want === 1 ? '' : 's'} you control to your hand — say which.`);
    }
    if (new Set(picks).size !== picks.length) return reject('noSuchCard', 'You named the same permanent twice.');
    const legalReturns = returnCandidatesFor(
      state,
      (cid: InstanceId) => derive(state, deps.oracle, deps.scripts, cid),
      intent.player,
      intent.card,
      ability.returnCost,
    );
    if (!picks.every((c) => legalReturns.includes(c))) {
      return reject('illegalReturn', `Those permanents cannot pay ${face.name}'s "${ability.costText}" cost.`);
    }
  }
  // D353 - the SELF COUNTER: a deterministic price, so the def gate is the whole check.
  if (ability.putCounterCost && !defReady) {
    return reject('notCastable', `${face.name}'s "${ability.costText}" cost is not one the app can pay — use the manual tools.`);
  }
  // ⚠️ The REMOVE-A-COUNTER cost (D319): the def gate, then the counters must be there.
  if (ability.removeCounterCost) {
    if (!defReady) {
      return reject('notCastable', `${face.name}'s "${ability.costText}" cost is not one the app can pay — use the manual tools.`);
    }
    if (ability.removeCounterCost.from === null) {
      // D447 - `kind: null` counts every kind (one is ever carried at priority, CR 704.5q).
      if (countersOfKind(card.counters, ability.removeCounterCost.kind) < ability.removeCounterCost.count) {
        return reject('notCastable', `${face.name} does not have the counters its "${ability.costText}" cost removes.`);
      }
    } else {
      // D363 - THE CHOOSER: re-validated against the same function the offer used,
      // and the picks are a MULTISET - a permanent named k times must carry k
      // counters of that kind.
      const rcKind = ability.removeCounterCost.kind;
      const rcCount = ability.removeCounterCost.count;
      const picks = intent.removeCounter ?? [];
      if (picks.length !== rcCount) {
        return reject('illegalRemoveCounter', `${face.name}'s "${ability.costText}" cost removes ${rcCount} counter${rcCount === 1 ? '' : 's'}.`);
      }
      const rcLegal = new Set(
        removeCounterCandidatesFor(
          state,
          (cid: InstanceId) => derive(state, deps.oracle, deps.scripts, cid),
          intent.player,
          intent.card,
          ability.removeCounterCost,
        ),
      );
      const rcNeed = new Map<InstanceId, number>();
      for (const pick of picks) rcNeed.set(pick, (rcNeed.get(pick) ?? 0) + 1);
      for (const [pick, n] of rcNeed) {
        if (!rcLegal.has(pick) || countersOfKind(state.cards[pick]?.counters ?? {}, rcKind) < n) {
          return reject('illegalRemoveCounter', `Those counters cannot pay ${face.name}'s "${ability.costText}" cost.`);
        }
      }
    }
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
  // D343 - CR 602.2b: a MODAL ability's modes are chosen at activation, before
  // its targets; the chosen modes' clauses are then what it aims. Its def
  // declares the modes (`ActivatedDef.modes`); named inline they are checked
  // here, absent the `modes` stage asks.
  const abilityModal = activatedModesFor(deps, abilityRef);
  const needsModes = abilityModal !== null && intent.modes === undefined;
  if (abilityModal !== null && intent.modes !== undefined) {
    const legal = legalModesFor(state, deps, intent.player, intent.card, abilityModal.modes);
    const problem = modeChoiceProblem(abilityModal.modes.length, abilityModal.choice.min, abilityModal.choice.max, legal, intent.modes);
    if (problem) return reject('illegalMode', problem);
  }
  if (needsModes && abilityModal !== null && legalModesFor(state, deps, intent.player, intent.card, abilityModal.modes).length < abilityModal.choice.min) {
    return reject('illegalMode', `No mode of ${face.name}'s "${ability.costText}" ability has a legal target right now.`);
  }
  const chosenModes = abilityModal !== null && intent.modes !== undefined ? modesInOrder(intent.modes) : [];
  const abilitySpecs = abilityModal !== null ? modeSpecs(abilityModal.modes, chosenModes) : ability.targets;
  if (intent.targets !== undefined && abilitySpecs.length > 0) {
    const verdict = validateTargets(
      abilitySpecs,
      { controller: intent.player, colors: face.colors },
      face.name,
      intent.targets,
      candidatesFromState(state, deps),
    );
    if (!verdict.ok) return reject('illegalTarget', verdict.message);
  }

  const stackId = `s${state.counters.stack + 1}`;
  // War Room's computed cost: the RULE was parsed, the NUMBER is read off the
  // player now (D159) — and it rides in the problem, so the targets stage, the
  // payment review and the wire all see the real price.
  const lifeToPay =
    ability.lifeCost +
    (ability.lifeCostCommanderColors ? (state.players[intent.player]?.identity.length ?? 0) : 0);
  const problem = buildPaymentProblem(ability.manaCost, 0, [], 0, lifeToPay);
  // D519 - an energy cost (CR 122.1) is charged in the cost batch; short of the counters the activation is refused here.
  if (ability.energyCost > (state.players[intent.player]?.energy ?? 0)) {
    return reject('cannotAfford', `You do not have ${ability.energyCost} energy to pay for ${face.name}.`);
  }
  const needsTargets = abilitySpecs.length > 0 && intent.targets === undefined;

  const pending: PendingCast = {
    player: intent.player,
    card: intent.card,
    // The chosen sacrifice rides the pending so the targets prompt cannot
    // lose it (D168); an `Awaiting` blocks every intent in the gap, so the
    // validated choice cannot go stale either.
    ...(ability.sacrificeCost && intent.sacrifice ? { sacrifice: [...intent.sacrifice] } : {}),
    ...(ability.energyCost > 0 ? { energy: ability.energyCost } : {}),
    ...(ability.discardCost && intent.discard ? { discard: [...intent.discard] } : {}),
    ...(ability.tapCost && intent.tap ? { tap: [...intent.tap] } : {}),
    ...(ability.exileFromGraveyardCost && intent.exileFromGraveyard ? { exileFromGraveyard: [...intent.exileFromGraveyard] } : {}),
    ...(ability.returnCost && intent.returnToHand ? { returnToHand: [...intent.returnToHand] } : {}),
    ...(ability.removeCounterCost?.from && intent.removeCounter ? { removeCounter: [...intent.removeCounter] } : {}),
    // An ability is a chit, not a card on the stack. See D155.
    faceIndex: 0,
    // ⚠️ Records where the permanent IS, and is never used to move it — an
    // ability leaves its source on the battlefield.
    from:
      ability.exileSelfFromGraveyard || ability.activatesFromGraveyard
        ? { kind: 'graveyard', player: intent.player }
        : ability.cycling !== undefined || ability.discardsSelf === true
          ? { kind: 'hand', player: intent.player }
          : { kind: 'battlefield', player: intent.player },
    stackId,
    stage: needsModes ? 'modes' : needsTargets ? 'targets' : 'pay',
    kind: 'ability',
    abilityRef,
    modes: chosenModes,
    targets: intent.targets ?? [],
    xValue: null,
    problem,
    paidSoFar: EMPTY_POOL,
    lifePaid: 0,
    isCommanderCast: false,
    taxApplied: 0,
  };

  if (needsModes && abilityModal !== null) {
    return accept([
      { t: 'CastBegan', pending },
      {
        t: 'AwaitingSet',
        awaiting: modesAwaiting(
          intent.player,
          stackId,
          intent.card,
          `${face.name} — ${ability.costText}: ${ability.effectText}`,
          abilityModal.modes,
          abilityModal.choice,
          legalModesFor(state, deps, intent.player, intent.card, abilityModal.modes),
          'ability',
        ),
      },
    ]);
  }
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
          abilitySpecs,
          'ability',
        ),
      },
    ]);
  }

  return finishAbility(state, deps, pending, face, ability, oracleCard.colorIdentity, intent.plan);
}

/**
 * D343 - the modes prompt's payload. `legal` is the host's own list and vouches
 * for nothing: the answer is checked again against the same helper.
 */
function modesAwaiting(
  player: PlayerId,
  stackId: StackId,
  source: InstanceId,
  label: string,
  modes: readonly ModeDecl[],
  choice: { readonly min: number; readonly max: number },
  legal: readonly number[],
  forKind: 'spell' | 'ability' | 'trigger',
): Extract<Awaiting, { kind: 'chooseModes' }> {
  return {
    kind: 'chooseModes',
    player,
    stackId,
    source,
    label,
    options: modes.map((m) => m.text),
    legal,
    min: choice.min,
    max: choice.max,
    forKind,
  };
}

/**
 * D343 - the answer to `chooseModes` (CR 700.2). A TRIGGER's object is already
 * on the stack: its modes are recorded on it and the chosen modes' targets are
 * asked next, exactly as `stackPendingTriggers` asks a targeted trigger's. A
 * SPELL or an ACTIVATION is a pending cast at stage `modes`: the modes are
 * recorded on it and the cast moves on - to X (CR 601.2b), to the chosen
 * modes' targets (601.2c), or straight to payment.
 */
function chooseModes(
  state: GameState,
  intent: Extract<Intent, { t: 'ChooseModes' }>,
  deps: EngineDeps,
): HandleResult {
  const awaiting = state.priority.awaiting;
  if (awaiting?.kind !== 'chooseModes') return reject('noPendingCast', 'Nothing is waiting for a choice of modes.');
  if (awaiting.player !== intent.player) return reject('notYourTurn', 'Those modes are not yours to choose.');
  const problem = modeChoiceProblem(awaiting.options.length, awaiting.min, awaiting.max, awaiting.legal, intent.modes);
  if (problem) return reject('illegalMode', problem);
  const modes = modesInOrder(intent.modes);

  if (awaiting.forKind === 'trigger') {
    const obj = state.stack.find((o) => o.id === awaiting.stackId);
    if (!obj) return reject('noPendingCast', 'That ability is no longer on the stack.');
    const specs = modeSpecs(triggerDefFor(deps, obj)?.modes ?? [], modes);
    const events: EventBody[] = [{ t: 'StackModesSet', stackId: obj.id, modes }];
    events.push(
      specs.length > 0
        ? { t: 'AwaitingSet', awaiting: targetsAwaiting(intent.player, obj.id, awaiting.source, awaiting.label, specs, 'trigger') }
        : { t: 'AwaitingSet', awaiting: null },
    );
    return accept(events);
  }

  const pending = state.pendingCast;
  if (!pending || pending.player !== intent.player) return reject('noPendingCast', 'You are not casting anything.');
  if (pending.stage !== 'modes') return reject('wrongCastStage', 'That spell is not waiting for a choice of modes.');
  const card = state.cards[pending.card];
  const oracleCard = card ? deps.oracle.byPrinting(card.printingId) : undefined;
  if (!card || !oracleCard) return reject('noSuchCard', 'That card is not in the game.');
  const face = faceOf(oracleCard, card.faceIndex);

  if (pending.kind === 'ability') {
    const ability = abilityOfRef(deps, face, pending.abilityRef);
    if (!ability) return reject('notCastable', 'That permanent has no such ability.');
    const specs = modeSpecs(activatedModesFor(deps, pending.abilityRef)?.modes ?? [], modes);
    if (specs.length > 0) {
      return accept([
        { t: 'ModesChosen', modes },
        { t: 'CastStageSet', stage: 'targets' },
        { t: 'AwaitingSet', awaiting: targetsAwaiting(intent.player, pending.stackId, pending.card, awaiting.label, specs, 'ability') },
      ]);
    }
    return finishAbility(state, deps, { ...pending, modes, stage: 'pay' }, face, ability, oracleCard.colorIdentity, undefined, [
      { t: 'ModesChosen', modes },
    ]);
  }

  const specs = modeSpecs(face.modal?.modes ?? [], modes);
  if (!!face.manaCost && face.manaCost.xCount > 0 && pending.xValue === null) {
    return accept([
      { t: 'ModesChosen', modes },
      { t: 'CastStageSet', stage: 'x' },
      { t: 'AwaitingSet', awaiting: { kind: 'chooseX', player: intent.player, stackId: pending.stackId, source: pending.card, label: face.name } },
    ]);
  }
  if (specs.length > 0) {
    return accept([
      { t: 'ModesChosen', modes },
      { t: 'CastStageSet', stage: 'targets' },
      { t: 'AwaitingSet', awaiting: targetsAwaiting(intent.player, pending.stackId, pending.card, face.name, specs, 'spell') },
    ]);
  }
  return finishFromPending(state, deps, { ...pending, modes, stage: 'pay' }, face, oracleCard.colorIdentity, {
    lead: [{ t: 'ModesChosen', modes }],
  });
}

/** The prompt payload. Everything a reconnecting client needs to rebuild it. */
function targetsAwaiting(
  player: PlayerId,
  stackId: StackId,
  source: InstanceId,
  label: string,
  specs: readonly TargetSpec[],
  forKind: 'spell' | 'ability' | 'trigger',
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
  // D474 - a ceased token's trigger aims by its last known printing (CR 603.10).
  const printing = source ? deps.oracle.byPrinting(source.printingId) : awaiting.lki ? deps.oracle.byPrinting(awaiting.lki.printingId) : undefined;
  if (!printing) return reject('noSuchCard', 'That card is not in the game.');
  const face = faceOf(printing, source ? source.faceIndex : (awaiting.lki?.faceIndex ?? 0));

  const verdict = validateTargets(
    awaiting.specs,
    // D341 - the source's own power and toughness, for a clause that compares against them (Mentor).
    targetingSourceFor(state, deps, awaiting.source, intent.player, awaiting.lki) ?? { controller: intent.player, colors: face.colors },
    awaiting.label,
    intent.targets,
    candidatesFromState(state, deps),
  );
  if (!verdict.ok) return reject('illegalTarget', verdict.message);

  return {
    ok: true,
    events: [
      // D437 - the clause each target answers rides the event: an optional first clause left empty must not shift the
      // second clause's pick into the first executor's aim (`picksFor` read `targets[clause]` for a trigger before).
      { t: 'StackTargetsSet', stackId: awaiting.stackId, targets: intent.targets, ...(verdict.assignment !== undefined ? { targetSlots: verdict.assignment } : {}) },
      { t: 'AwaitingSet', awaiting: null },
    ],
  };
}

/**
 * D487 - THE COPY'S NEW TARGETS (CR 707.10c). The copy is on the stack with the original's targets; an empty answer
 * keeps them, a full one replaces them - validated against the copied face's clauses exactly as a trigger's are, the
 * copied spell's card the targeting source and the copy's own colours where the clause set them. The clauses after
 * the copying one (the D484 continuation the question carried) run once the targets are settled.
 */
function chooseCopyTargets(
  state: GameState,
  intent: Extract<Intent, { t: 'ChooseTargets' }>,
  deps: EngineDeps,
  awaiting: Extract<Awaiting, { kind: 'chooseTargets' }>,
): HandleResult {
  if (awaiting.player !== intent.player) return reject('notYourTurn', 'That copy is not yours to aim.');
  const copy = state.stack.find((o) => o.id === awaiting.stackId);
  if (!copy || copy.copyOf === undefined) return reject('noPendingCast', 'That copy is no longer on the stack.');
  const events: EventBody[] = [];
  if (intent.targets.length === 0) {
    events.push(narrated(`${copy.label} keeps its targets.`, copy.controller, copy.identity));
  } else {
    const printing = deps.oracle.byPrinting(copy.copyOf.printingId);
    if (!printing) return reject('noSuchCard', 'That card is not in the game.');
    const face = faceOf(printing, copy.copyOf.faceIndex);
    const own = targetingSourceFor(state, deps, awaiting.source, intent.player) ?? { controller: intent.player, colors: face.colors };
    const src = copy.copyOf.colors === undefined ? own : { ...own, colors: copy.copyOf.colors };
    const verdict = validateTargets(awaiting.specs, src, awaiting.label, intent.targets, candidatesFromState(state, deps));
    if (!verdict.ok) return reject('illegalTarget', verdict.message);
    events.push({ t: 'StackTargetsSet', stackId: copy.id, targets: intent.targets, ...(verdict.assignment !== undefined ? { targetSlots: verdict.assignment } : {}) });
  }
  events.push({ t: 'AwaitingSet', awaiting: null });
  return accept(events, resumeContinuation(state, deps, events, awaiting.continuation));
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
  // D487 - a copy's new targets: its object is on the stack too, and an empty answer keeps the original's.
  if (awaiting?.kind === 'chooseTargets' && awaiting.forKind === 'copy') {
    return chooseCopyTargets(state, intent, deps, awaiting);
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
  // D343 - a modal spell or ability aims the CHOSEN modes' clauses.
  const abilityModal = pending.kind === 'ability' ? activatedModesFor(deps, pending.abilityRef) : null;
  const specs = pending.kind === 'ability'
    ? abilityModal !== null
      ? modeSpecs(abilityModal.modes, pending.modes)
      : abilityOfRef(deps, face, pending.abilityRef)?.targets ?? []
    : face.modal
      ? modeSpecs(face.modal.modes, pending.modes)
      : castTargetSpecs(face, pending.alternative === true);

  // D341 - a staged ability's source carries its power and toughness; a spell on the stack has none.
  const src = targetingSourceFor(state, deps, pending.card, intent.player) ?? { controller: intent.player, colors: face.colors };
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
    const ability = abilityOfRef(deps, face, pending.abilityRef);
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
  const base = buildPaymentProblem(
    // D491 - a granted cast keeps paying nothing when the targets price the problem (the ward still rides it).
    // D535 - and a flashback, alternative or face-down cast keeps paying what it chose (`stagedCastCost`).
    stagedCastCost(face, pending),
    pending.xValue ?? 0,
    // D403 - the kick announced with the cast stays in the problem the targets reprice.
    [...ward.mana, ...kickerMana(face, pending.kicked ?? 0, pending.kickedWith ?? []), ...buybackMana(face, pending.buyback === true), ...replicateMana(face, pending.replicated ?? 0), ...additionalExtras(face, pending.orPaid === true, kickVerbOf(face, pending.kicked ?? 0, pending.buyback === true)).mana],
    pending.taxApplied,
    ward.life + additionalExtras(face, pending.orPaid === true, kickVerbOf(face, pending.kicked ?? 0, pending.buyback === true)).life + stagedCastLife(face, pending),
  );
  // D405 - the alternatives the cast named stay in the problem the targets reprice.
  const priced = priceAlternatives(state, deps, face, base, pending.alt ?? NO_ALT);
  if ('error' in priced) return priced.error;
  const problem = priced.problem;

  return finishFromPending(
    state,
    deps,
    { ...pending, targets: intent.targets, ...(verdict.assignment !== undefined ? { targetSlots: verdict.assignment } : {}), problem, stage: 'pay' },
    face,
    oracleCard.colorIdentity,
    {
      lead: [{ t: 'TargetsChosen', targets: intent.targets, problem }],
      // `chooseX` logged it already when this cast had an X stage.
      xAlreadyLogged: pending.xValue !== null,
    },
  );
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

function cancelPendingCast(state: GameState, player: PlayerId, deps: EngineDeps): HandleResult {
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
      // D540 - a foretold card backed out of goes back as it was: face down, foretold on the turn it was.
      // D541 - a madness cast backed out of was not cast: the card goes to its owner's graveyard (CR 702.35a).
      // D551 - a plotted card backed out of goes back plotted on the turn it was.
      moves: [{ card: pending.card, from: { kind: 'stack', player: null }, to: pending.madness === true ? { kind: 'graveyard', player: state.cards[pending.card]?.owner ?? player } : pending.from, ...(pending.foretold !== undefined ? { faceDown: true, foretoldTurn: pending.foretold } : {}), ...(pending.plotted !== undefined ? { plottedTurn: pending.plotted } : {}) }],
    });
  }
  events.push({ t: 'CastCancelled', stackId: pending.stackId });
  // Backing out also dismisses whatever the cast was asking for.
  events.push({ t: 'AwaitingSet', awaiting: null });
  // D491 - backing out of a granted cast still runs the granting effect's remaining clauses.
  return accept(events, resumeContinuation(state, deps, events, pending.continuation));
}

interface CompleteArgs {
  player: PlayerId;
  card: InstanceId;
  faceIndex: number;
  xValue: number;
  targets: readonly import('./types/state').TargetChoice[];
  /** D299: the clause each target answers (see `StackObject.targetSlots`). */
  targetSlots?: readonly number[];
  /** D343: the chosen modes of a modal spell, in printed order. */
  modes?: readonly number[];
  plan?: import('./types/mana').PaymentPlan;
  setup: CastSetup;
  /** D491 - events before the cast's own (a granted cast dismisses the chooser it was answered from). */
  lead?: readonly EventBody[];
  /** D491 - the granting effect's remaining clauses, run once the cast is complete. */
  continuation?: EffectContinuation;
}

function completeCast(state: GameState, deps: EngineDeps, args: CompleteArgs): HandleResult {
  const { setup } = args;
  // D405 - a permanent the cast taps for convoke or improvise is no mana source for the same cast.
  const solve = solveWithout(solveInputFor(state, deps.oracle, deps.scripts, args.player), setup.alt, setup.picks.tap);
  // D397 - the spell this face is cast as, face down a colourless creature (CR 708.2).
  const purpose = spellPurpose(setup.face, setup.faceDown === true);
  const plan = args.plan ?? suggestPayment(solve, setup.problem, purpose);
  if (!plan) {
    return reject(
      'cannotAfford',
      `You cannot pay ${setup.face.manaCost?.raw ?? ''}${setup.tax > 0 ? ` plus {${setup.tax}} commander tax` : ''} for ${setup.face.name}.`,
    );
  }
  const problem = validatePlan(state, deps.oracle, deps.scripts, args.player, setup.problem, plan, purpose);
  if (problem === 'stale') {
    return reject('stalePaymentPlan', 'The board changed while you were paying. Try again.');
  }
  if (problem === 'invalid') {
    return reject('invalidPaymentPlan', 'That payment does not cover the cost.');
  }
  if (planTapsAlt(plan, setup.alt, setup.picks.tap)) return reject('invalidPaymentPlan', 'That payment taps a permanent the cast already taps.');
  // D406 - the additional cost's picks, paid first (a sacrifice, a discard, a tap, an exile, a return).
  const paid = additionalCostEvents(state, deps, args.player, setup.identity, setup.picks);
  if ('error' in paid) return paid.error;

  const stackId = `s${state.counters.stack + 1}`;
  const events: EventBody[] = [
    ...(args.lead ?? []),
    {
      t: 'CardsMoved',
      moves: [
        {
          card: args.card,
          from: setup.from,
          to: { kind: 'stack', player: null },
          ...(args.faceIndex === 0 ? {} : { faceIndex: args.faceIndex }),
          ...(setup.faceDown ? { faceDown: true } : {}),
        },
      ],
    },
  ];
  // D405 - the taps and the exiles of convoke, improvise and delve, then the mana.
  events.push(...paid.events);
  events.push(...altEvents(state, args.player, setup.alt));
  events.push(...payEvents(state, deps, args.player, plan, setup, purpose));

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
    ...(args.targetSlots !== undefined ? { targetSlots: args.targetSlots } : {}),
    modes: args.modes ?? [],
    xValue: args.xValue > 0 ? args.xValue : null,
    label: setup.faceDown ? 'a face-down creature' : setup.face.name,
    identity: setup.identity,
    taxApplied: setup.tax,
    isCommanderCast: setup.from.kind === 'command',
    castFrom: setup.from,
    ...(setup.faceDown ? { faceDown: true as const } : {}),
    ...(setup.kicked > 0 ? { kicked: setup.kicked } : {}),
    ...(setup.kickedWith.length > 0 ? { kickedWith: setup.kickedWith } : {}),
    ...(setup.buyback ? { buyback: true as const } : {}),
    ...(setup.replicated > 0 ? { replicated: setup.replicated } : {}),
    ...altCounts(setup.alt),
    ...additionalPaidOf(setup.face, setup.picks, setup.orPaid),
    ...(setup.alternative ? { alternativePaid: true as const } : {}),
    ...(setup.free ? { freeCast: true as const } : {}),
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
      n`${who(state, args.player)} ${vb(args.player, 'casts', 'cast')} ${setup.faceDown ? 'a face-down creature' : setup.face.name}${setup.tax > 0 ? ` (commander tax {${setup.tax}})` : ''}${altNote(setup.alt)}${setup.free ? ' without paying its mana cost' : ''}.`,
      args.player,
      setup.identity,
    ),
  );
  events.push(...retainPriority(args.player, state.stack.length + 1));
  // D491 - a granted cast's completion runs the granting effect's remaining clauses (D484's funnel).
  return accept(events, resumeContinuation(state, deps, events, args.continuation));
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
  // D397 - an ability of ITS SOURCE: restricted mana that names the source's kind pays it.
  const src = derive(state, deps.oracle, deps.scripts, pending.card);
  const purpose = abilityPurpose(src.typeLine, src.colors);
  const chosen = plan ?? suggestPayment(solve, pending.problem, purpose);
  if (!chosen) return reject('cannotAfford', `You cannot pay ${ability.costText} for ${face.name}.`);
  const problem = validatePlan(state, deps.oracle, deps.scripts, pending.player, pending.problem, chosen, purpose);
  if (problem === 'stale') return reject('stalePaymentPlan', 'The board changed while you were paying. Try again.');
  if (problem === 'invalid') return reject('invalidPaymentPlan', 'That payment does not cover the cost.');

  const events: EventBody[] = [...lead];
  events.push({ t: 'AwaitingSet', awaiting: null });
  // D328 - a random discard draws off the seeded rng; the rng after rides
  // the accept exactly as a coin flip's does, so the log replays.
  let rngAfter: Parameters<typeof accept>[1];
  events.push(
    ...payEvents(state, deps, pending.player, chosen, {
      problem: pending.problem,
      face,
      tax: 0,
      from: pending.from,
      identity,
    }, purpose),
  );
  // CR 602.2b — the tap is part of the COST, so it is paid now, in this batch.
  if (ability.requiresTap) events.push({ t: 'PermanentsTapped', cards: [pending.card] });
  if (ability.requiresUntap) events.push({ t: 'PermanentsUntapped', cards: [pending.card] });
  // D519 - the energy cost (CR 122.1), paid in the same batch as the tap: the counters the activation was refused without.
  if (pending.energy !== undefined && pending.energy > 0) {
    const held = state.players[pending.player]?.energy ?? 0;
    if (held < pending.energy) return reject('cannotAfford', `You no longer have ${pending.energy} energy to pay for ${face.name}.`);
    events.push({ t: 'EnergyChanged', player: pending.player, delta: -pending.energy, to: held - pending.energy });
  }
  // ⚠️ THE SELF-SACRIFICE IS A COST TOO (CR 602.2b, D159) — paid here, before
  // the ability is on the stack, so the source is already in its owner's
  // graveyard when anything can respond. The move goes through the ordinary
  // event so dies-triggers (Onulet's shape) and the funnel see it like any
  // other death; `resolve` must therefore never assume its source is still on
  // the battlefield. Reachable only past `legal.ts`'s and `activateAbility`'s
  // def gates, so it can never eat a permanent for a scriptless ability.
  // ⚠️ The CHOSEN sacrifice (D168) is charged exactly where the self-
  // sacrifice is — in the cost batch, through the ordinary event, so
  // dies-triggers and the funnel see it like any other death. Validated at
  // activation and unreachable past the def gates, so it can never eat a
  // permanent for a scriptless ability.
  if (ability.sacrificeCost && pending.sacrifice && pending.sacrifice.length > 0) {
    // D353 - N permanents in ONE `CardsMoved`, so every death is simultaneous and the
    // dies-triggers see one batch, exactly as a wipe does.
    // D377 - `reason: 'sacrifice'` is what tells a watcher this death was a sacrifice: the move
    // itself is an ordinary battlefield-to-graveyard `CardsMoved`, which is exactly why D177
    // refused the family for want of a discriminator.
    const moves: { card: InstanceId; from: { kind: 'battlefield'; player: PlayerId }; to: { kind: 'graveyard'; player: PlayerId }; reason: 'sacrifice' }[] = [];
    let chosen = state.cards[pending.sacrifice[0] as InstanceId];
    for (const id of pending.sacrifice) {
      const inst = state.cards[id];
      if (!inst || inst.zone.kind !== 'battlefield') {
        return reject('noSuchCard', 'A permanent chosen for the sacrifice is not on the battlefield.');
      }
      chosen = inst;
      moves.push({ card: id, from: { kind: 'battlefield', player: inst.controller }, to: { kind: 'graveyard', player: inst.owner }, reason: 'sacrifice' });
    }
    events.push({ t: 'CardsMoved', moves });
    // The line names WHAT DIED, not the source — "You sacrifice Grizzly
    // Bears.", with the activation line below saying why (D100's rule: a
    // permanent must never leave the battlefield without the log saying so).
    // ⚠️ ONE permanent is named; N is a count, the discard chooser's wording (D286).
    const chosenPrinting = chosen ? deps.oracle.byPrinting(chosen.printingId) : null;
    const chosenName =
      moves.length > 1
        ? `${moves.length} permanents`
        : chosenPrinting && chosen
          ? faceOf(chosenPrinting, chosen.faceIndex).name
          : 'a permanent';
    events.push(
      narrated(
        n`${who(state, pending.player)} ${vb(pending.player, 'sacrifices', 'sacrifice')} ${chosenName}.`,
        pending.player,
        identity,
      ),
    );
  }
  // ⚠️ The CHOSEN discard (D286): charged in the cost batch through the
  // ordinary hand→graveyard move, so discard-event watchers see it like any
  // other discard. Re-checked here because the targets prompt may have sat
  // between the choice and the charge.
  // D328 - "Discard a card at random": the seeded rng picks, at payment.
  if (ability.discardCost?.atRandom) {
    const held = state.zones.hand[pending.player] ?? [];
    if (held.length < ability.discardCost.count) return reject('cannotAfford', `You cannot pay ${ability.costText} for ${face.name}.`);
    const drawn = shuffle(state.rng, held);
    rngAfter = drawn.next;
    const moves: { card: InstanceId; from: { kind: 'hand'; player: PlayerId }; to: { kind: 'graveyard'; player: PlayerId }; reason: 'discard' }[] = [];
    for (const chosen of drawn.value.slice(0, ability.discardCost.count)) {
      const inst = state.cards[chosen];
      if (!inst) return reject('noSuchCard', 'A card in your hand is not in the game.');
      moves.push({ card: chosen, from: { kind: 'hand', player: pending.player }, to: { kind: 'graveyard', player: inst.owner }, reason: 'discard' });
    }
    events.push({ t: 'CardsMoved', moves });
    events.push(
      narrated(
        n`${who(state, pending.player)} ${vb(pending.player, 'discards', 'discard')} ${moves.length} card${moves.length === 1 ? '' : 's'} at random.`,
        pending.player,
        identity,
      ),
    );
  }
  if (ability.discardCost && !ability.discardCost.atRandom && pending.discard && pending.discard.length > 0) {
    const moves: { card: InstanceId; from: { kind: 'hand'; player: PlayerId }; to: { kind: 'graveyard'; player: PlayerId }; reason: 'discard' }[] = [];
    for (const chosen of pending.discard) {
      const inst = state.cards[chosen];
      if (!inst || inst.zone.kind !== 'hand' || inst.zone.player !== pending.player) {
        return reject('noSuchCard', 'A card chosen for the discard is no longer in your hand.');
      }
      moves.push({ card: chosen, from: { kind: 'hand', player: pending.player }, to: { kind: 'graveyard', player: inst.owner }, reason: 'discard' });
    }
    events.push({ t: 'CardsMoved', moves });
    events.push(
      narrated(
        n`${who(state, pending.player)} ${vb(pending.player, 'discards', 'discard')} ${moves.length} card${moves.length === 1 ? '' : 's'}.`,
        pending.player,
        identity,
      ),
    );
  }
  // ⚠️ The CHOSEN taps (D286): one `PermanentsTapped` in the cost batch.
  if (ability.tapCost && pending.tap && pending.tap.length > 0) {
    for (const chosen of pending.tap) {
      const inst = state.cards[chosen];
      if (!inst || inst.zone.kind !== 'battlefield' || inst.tapped || inst.controller !== pending.player) {
        return reject('noSuchCard', 'A permanent chosen to tap is no longer untapped under your control.');
      }
    }
    events.push({ t: 'PermanentsTapped', cards: [...pending.tap] });
    events.push(
      narrated(
        n`${who(state, pending.player)} ${vb(pending.player, 'taps', 'tap')} ${pending.tap.length} permanent${pending.tap.length === 1 ? '' : 's'}.`,
        pending.player,
        identity,
      ),
    );
  }
  // ⚠️ D306 - THE CYCLING DISCARD IS THE COST (CR 702.29a), paid here in the
  // cost batch through the ordinary hand->graveyard move, so discard watchers
  // see it like any other discard and the source sits in its owner's graveyard
  // before anything can respond - `resolveAbility` reads `obj.controller`.
  if (ability.cycling !== undefined) {
    const src = state.cards[pending.card];
    if (!src || src.zone.kind !== 'hand' || src.zone.player !== pending.player) {
      return reject('noSuchCard', 'The card being cycled is no longer in your hand.');
    }
    events.push({
      t: 'CardsMoved',
      // D377 - `cycling`, never `discard`: a cycling discard IS both, and the printed heads tell
      // them apart ("Whenever you cycle or discard a card" names both, "Whenever you cycle a card"
      // one), so the head reads the pair rather than the move carrying a second flag.
      moves: [{ card: pending.card, from: { kind: 'hand', player: pending.player }, to: { kind: 'graveyard', player: src.owner }, reason: 'cycling' }],
    });
    events.push(
      narrated(
        n`${who(state, pending.player)} ${vb(pending.player, 'cycles', 'cycle')} ${face.name}.`,
        pending.player,
        identity,
      ),
    );
  }
  // D451 - "Discard this card" IS the cost (CR 113.6), paid in the cost batch through the ordinary
  // hand->graveyard move with the discard reason, so discard watchers see it; the source sits in its
  // owner's graveyard before anything can respond.
  if (ability.discardsSelf === true) {
    const src = state.cards[pending.card];
    if (!src || src.zone.kind !== 'hand' || src.zone.player !== pending.player) {
      return reject('noSuchCard', 'The card being discarded is no longer in your hand.');
    }
    events.push({ t: 'CardsMoved', moves: [{ card: pending.card, from: { kind: 'hand', player: pending.player }, to: { kind: 'graveyard', player: src.owner }, reason: 'discard' }] });
    events.push(narrated(n`${who(state, pending.player)} ${vb(pending.player, 'discards', 'discard')} ${face.name}.`, pending.player, identity));
  }
  // D329 - "Exile this card from your graveyard" IS the cost (CR 113.6), paid
  // in the cost batch: the source leaves the graveyard before anything can
  // respond, and the effect resolves off a source in exile.
  if (ability.exileSelfFromGraveyard) {
    const src = state.cards[pending.card];
    if (!src || src.zone.kind !== 'graveyard' || src.zone.player !== pending.player) {
      return reject('noSuchCard', 'The card is no longer in your graveyard.');
    }
    events.push({
      t: 'CardsMoved',
      moves: [{ card: pending.card, from: { kind: 'graveyard', player: pending.player }, to: { kind: 'exile', player: src.owner } }],
    });
    events.push(
      narrated(
        n`${who(state, pending.player)} ${vb(pending.player, 'exiles', 'exile')} ${face.name} from the graveyard.`,
        pending.player,
        identity,
      ),
    );
  }
  // D329 - the CHOSEN graveyard exiles: one `CardsMoved` in the cost batch.
  if (ability.exileFromGraveyardCost && pending.exileFromGraveyard && pending.exileFromGraveyard.length > 0) {
    const moves: { card: InstanceId; from: { kind: 'graveyard'; player: PlayerId }; to: { kind: 'exile'; player: PlayerId } }[] = [];
    for (const chosen of pending.exileFromGraveyard) {
      const inst = state.cards[chosen];
      if (!inst || inst.zone.kind !== 'graveyard' || inst.zone.player !== pending.player) {
        return reject('noSuchCard', 'A card chosen for the exile is no longer in your graveyard.');
      }
      moves.push({ card: chosen, from: { kind: 'graveyard', player: pending.player }, to: { kind: 'exile', player: inst.owner } });
    }
    events.push({ t: 'CardsMoved', moves });
    events.push(
      narrated(
        n`${who(state, pending.player)} ${vb(pending.player, 'exiles', 'exile')} ${moves.length} card${moves.length === 1 ? '' : 's'} from the graveyard.`,
        pending.player,
        identity,
      ),
    );
  }
  // D352 - THE CHOSEN RETURNS: one `CardsMoved` in the cost batch, battlefield to the
  // OWNER's hand (a permanent you control but do not own goes home, CR 701.3a).
  if (ability.returnCost && pending.returnToHand && pending.returnToHand.length > 0) {
    const moves: { card: InstanceId; from: { kind: 'battlefield'; player: PlayerId }; to: { kind: 'hand'; player: PlayerId } }[] = [];
    for (const chosen of pending.returnToHand) {
      const inst = state.cards[chosen];
      if (!inst || inst.zone.kind !== 'battlefield' || inst.controller !== pending.player) {
        return reject('noSuchCard', 'A permanent chosen to return is no longer on the battlefield under your control.');
      }
      moves.push({ card: chosen, from: { kind: 'battlefield', player: pending.player }, to: { kind: 'hand', player: inst.owner } });
    }
    events.push({ t: 'CardsMoved', moves });
    // D462 - a returned attacker leaves combat with the return (CR 506.4).
    if (state.combat !== null) {
      const inCombat = moves.map((m) => m.card).filter((c) => state.combat?.attackers.some((a) => a.card === c) || state.combat?.blockers.some((b) => b.card === c));
      if (inCombat.length > 0) events.push({ t: 'RemovedFromCombat', cards: inCombat });
    }
    events.push(
      narrated(
        n`${who(state, pending.player)} ${vb(pending.player, 'returns', 'return')} ${moves.length} permanent${moves.length === 1 ? '' : 's'} to hand.`,
        pending.player,
        identity,
      ),
    );
  }
  // D352 - THE SELF RETURN: the source itself is the price, paid in the cost batch, so the
  // effect resolves off a source in HAND - `resolveAbility` reads `obj.controller`.
  if (ability.returnsSelf) {
    const src = state.cards[pending.card];
    if (!src) return reject('noSuchCard', 'That permanent is not in the game.');
    events.push({
      t: 'CardsMoved',
      moves: [
        {
          card: pending.card,
          from: { kind: 'battlefield', player: pending.player },
          to: { kind: 'hand', player: src.owner },
        },
      ],
    });
    events.push(
      narrated(
        n`${who(state, pending.player)} ${vb(pending.player, 'returns', 'return')} ${face.name} to hand.`,
        pending.player,
        identity,
      ),
    );
  }
  // D353 - THE SELF COUNTER: the counters go ON as the cost is paid (CR 601.2h), the
  // remove-a-counter cost's mirror. A -1/-1 counter may kill the permanent; the
  // state-based action does that, not this.
  if (ability.putCounterCost) {
    const { kind: counterKind, count } = ability.putCounterCost;
    events.push({ t: 'CountersChanged', changes: [{ card: pending.card, kind: counterKind, delta: count }] });
    events.push(
      narrated(
        n`${who(state, pending.player)} ${vb(pending.player, 'puts', 'put')} ${count} ${counterKind} counter${count === 1 ? '' : 's'} on ${face.name}.`,
        pending.player,
        identity,
      ),
    );
  }
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
          reason: 'sacrifice',
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

  // D319 - the counters come off as the cost is paid (CR 601.2h), beside the
  // self-sacrifice: deterministic, so no chooser rode the pending.
  if (ability.removeCounterCost) {
    const src = state.cards[pending.card];
    if (!src) return reject('noSuchCard', 'That permanent is not in the game.');
    const { kind, count } = ability.removeCounterCost;
    // D363 - the chooser named the permanents at activation and they rode the
    // pending; the SELF cost (D319) names none and takes them off the source.
    const need = new Map<InstanceId, number>();
    if (ability.removeCounterCost.from === null) need.set(pending.card, count);
    else for (const pick of pending.removeCounter ?? []) need.set(pick, (need.get(pick) ?? 0) + 1);
    for (const [pick, n] of need) {
      if (countersOfKind(state.cards[pick]?.counters ?? {}, kind) < n) {
        return reject('notCastable', `${face.name} no longer has the counters its "${ability.costText}" cost removes.`);
      }
    }
    // D447 - a cost that names no kind takes the kind the permanent carries: the kinds present are
    // drained in a fixed (sorted) order, which only matters in a state no player ever acts in.
    const changes: { card: InstanceId; kind: string; delta: number }[] = [];
    for (const [pick, n] of need) {
      if (kind !== null) {
        changes.push({ card: pick, kind, delta: -n });
        continue;
      }
      let left = n;
      const carried = state.cards[pick]?.counters ?? {};
      for (const k of Object.keys(carried).sort()) {
        const take = Math.min(left, carried[k] ?? 0);
        if (take <= 0) continue;
        changes.push({ card: pick, kind: k, delta: -take });
        left -= take;
        if (left === 0) break;
      }
    }
    events.push({ t: 'CountersChanged', changes });
    events.push(
      narrated(
        n`${who(state, pending.player)} ${vb(pending.player, 'removes', 'remove')} ${count}${kind === null ? '' : ' ' + kind} counter${count === 1 ? '' : 's'} from ${face.name}.`,
        pending.player,
        identity,
      ),
    );
  }

  // D472 - CR 606: the loyalty cost is the counters themselves, added or removed as the ability goes on the stack.
  if (ability.loyaltyCost !== undefined && ability.loyaltyCost !== 0) {
    events.push({ t: 'CountersChanged', changes: [{ card: pending.card, kind: 'loyalty', delta: ability.loyaltyCost }] });
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
    modes: pending.modes,
    xValue: null,
    label: `${face.name} — ${ability.effectText}`,
    identity,
    taxApplied: 0,
    isCommanderCast: false,
    castFrom: null,
    // D457 - the reducer stamps the source's exhaust memory off this flag.
    ...(ability.exhaust ? { exhaust: true as const } : {}),
    ...(ability.boast ? { boast: true as const } : {}),
    // D472 - the reducer records the permanent's loyalty activation off this field.
    ...(ability.loyaltyCost !== undefined ? { loyalty: ability.loyaltyCost } : {}),
    // D462 - the defender the returned creature was attacking, read before the return was charged (CR 702.49a).
    ...(ability.ninjutsu !== undefined && pending.returnToHand && pending.returnToHand.length > 0
      ? (() => { const d = state.combat?.attackers.find((a) => a.card === pending.returnToHand?.[0])?.defender; return d ? { ninjutsuDefender: d } : {}; })()
      : {}),
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
  return accept(events, rngAfter);
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
  // D405 - a permanent the cast taps for convoke or improvise is no mana source for the same cast.
  const alt = pending.alt ?? NO_ALT;
  const picks = pending.kind === 'spell' ? picksOf(pending) : NO_PICKS;
  const solve = solveWithout(solveInputFor(state, deps.oracle, deps.scripts, pending.player), alt, picks.tap);
  // D397 - what this pays for: the spell the face is cast as, or the ability of its source.
  const src = pending.kind === 'ability' ? derive(state, deps.oracle, deps.scripts, pending.card) : null;
  const purpose = src ? abilityPurpose(src.typeLine, src.colors) : spellPurpose(face, pending.faceDown === true);
  const chosen = plan ?? suggestPayment(solve, pending.problem, purpose);
  if (!chosen) {
    return reject('cannotAfford', `You cannot pay for ${face.name} with X = ${pending.xValue ?? 0}.`);
  }
  const problem = validatePlan(state, deps.oracle, deps.scripts, pending.player, pending.problem, chosen, purpose);
  if (problem === 'stale') return reject('stalePaymentPlan', 'The board changed while you were paying. Try again.');
  if (problem === 'invalid') return reject('invalidPaymentPlan', 'That payment does not cover the cost.');
  if (planTapsAlt(chosen, alt, picks.tap)) return reject('invalidPaymentPlan', 'That payment taps a permanent the cast already taps.');
  const paid = additionalCostEvents(state, deps, pending.player, identity, picks);
  if ('error' in paid) return paid.error;

  const setup: CastSetup = {
    problem: pending.problem,
    face,
    tax: pending.taxApplied,
    from: pending.from,
    kicked: pending.kicked ?? 0,
    kickedWith: pending.kickedWith ?? [],
    buyback: pending.buyback === true,
    replicated: pending.replicated ?? 0,
    alt,
    picks,
    orPaid: pending.orPaid === true,
    alternative: pending.alternative === true,
    ...(pending.free === true ? { free: true as const } : {}),
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
  // D406 - the additional cost's picks first, then D405's taps and exiles, then the mana.
  events.push(...paid.events);
  events.push(...altEvents(state, pending.player, alt));
  events.push(...payEvents(state, deps, pending.player, chosen, setup, purpose));

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
    ...(pending.targetSlots !== undefined ? { targetSlots: pending.targetSlots } : {}),
    modes: pending.modes,
    xValue: pending.xValue,
    label: face.name,
    identity,
    taxApplied: pending.taxApplied,
    isCommanderCast: pending.isCommanderCast,
    castFrom: pending.from,
    ...(pending.kicked !== undefined && pending.kicked > 0 ? { kicked: pending.kicked } : {}),
    ...(pending.kickedWith !== undefined && pending.kickedWith.length > 0 ? { kickedWith: pending.kickedWith } : {}),
    ...(pending.buyback === true ? { buyback: true as const } : {}),
    ...(pending.replicated !== undefined && pending.replicated > 0 ? { replicated: pending.replicated } : {}),
    ...altCounts(alt),
    ...additionalPaidOf(face, picks, pending.orPaid === true),
    ...(pending.alternative === true ? { alternativePaid: true as const } : {}),
    ...(pending.free === true ? { freeCast: true as const } : {}),
  };
  events.push({ t: 'SpellCast', obj });
  if (pending.isCommanderCast && card?.isCommander) {
    events.push({ t: 'CommanderCastCountIncreased', card: pending.card, to: card.commanderCastCount + 1 });
  }
  events.push(
    narrated(
      n`${who(state, pending.player)} ${vb(pending.player, 'casts', 'cast')} ${face.name}${pending.xValue ? ` with X = ${pending.xValue}` : ''}${altNote(alt)}${pending.free === true ? ' without paying its mana cost' : ''}.`,
      pending.player,
      identity,
    ),
  );
  events.push(...retainPriority(pending.player, state.stack.length + 1));
  // D491 - a granted cast's completion runs the granting effect's remaining clauses (D484's funnel).
  return accept(events, resumeContinuation(state, deps, events, pending.continuation));
}

/**
 * D364 - which part of a pool spend was SNOW mana.
 *
 * Non-snow first, because snow mana kept is a `{S}` still payable; snow only
 * where the ordinary mana runs out, then topped up to the `{S}` requirement.
 * The reservation in `payment.ts` is what guarantees the top-up can be met.
 */
function snowOfSpend(
  spend: ManaPool,
  snowAvailable: Record<ManaSymbolKey, number>,
  total: Record<ManaSymbolKey, number>,
  need: number,
): ManaPool {
  const out: Record<ManaSymbolKey, number> = { W: 0, U: 0, B: 0, R: 0, G: 0, C: 0 };
  // Forced: more of this colour is being spent than there is ordinary mana of it.
  for (const k of KEYS) {
    const ordinary = Math.max(0, total[k] - snowAvailable[k]);
    out[k] = Math.min(Math.max(0, spend[k] - ordinary), snowAvailable[k]);
  }
  let have = 0;
  for (const k of KEYS) have += out[k];
  // Topped up to what the {S} symbols require.
  for (const k of KEYS) {
    if (have >= need) break;
    const room = Math.min(spend[k], snowAvailable[k]) - out[k];
    const take = Math.min(Math.max(0, room), need - have);
    out[k] += take;
    have += take;
  }
  return { ...out };
}

/**
 * D355 / D411 - THE PRICE A MANA LINE CHARGES, in the same accept as the mana (a mana ability does not use
 * the stack, CR 605.1): the painland's damage, the depletion land's untap skip. ONE helper for both the
 * hand tap (`tapForMana`) and the plan taps of an auto-paid cast (`payEvents`) - the latter charged
 * nothing until D411, an auto-paid painland dealing no damage.
 */
function manaDrawbackEvents(source: Pick<ManaSource, 'drawback'>, card: InstanceId, player: PlayerId): EventBody[] {
  const d = source.drawback;
  if (!d) return [];
  if (d.kind === 'skipUntap') return [{ t: 'UntapSkipSet', card, skip: true }];
  return [{
    t: 'DamageDealt',
    damages: [{ source: card, target: { kind: 'player', id: player }, amount: d.amount, deathtouch: false, lifelinkTo: null, isCommanderDamage: false, viaTrample: 0, applyAs: 'normal', toxic: 0 }],
  }];
}

/** Taps, mana added, mana spent, life paid — CR 601.2g/h, each its own event. */
function payEvents(
  state: GameState,
  deps: EngineDeps,
  player: PlayerId,
  plan: import('./types/mana').PaymentPlan,
  setup: CastSetup | Pick<CastSetup, 'problem'>,
  purpose: SpendPurpose,
): EventBody[] {
  const events: EventBody[] = [];
  const sources = manaSourcesOf(state, deps.oracle, deps.scripts, player, { includeConditional: true });
  const produced: Record<ManaSymbolKey, number> = { W: 0, U: 0, B: 0, R: 0, G: 0, C: 0 };
  const producedSnow: Record<ManaSymbolKey, number> = { W: 0, U: 0, B: 0, R: 0, G: 0, C: 0 };
  // D397 - the FITTING buckets this spend may draw on: what the pool held under a restriction
  // the purpose fits, plus what the plan's own taps make under one (every tap in a validated
  // plan fits, so its mana lands in a fitting bucket and is spent straight back out of it).
  let fitting: readonly RestrictedMana[] = bucketsFitting(state.players[player]?.poolRestricted ?? [], purpose);
  const tapped: InstanceId[] = [];
  const riders: EventBody[] = [];

  for (const tap of plan.taps) {
    const source = sources.find((s) => s.card === tap.source && s.abilityIndex === tap.abilityIndex);
    const output = source?.outputs[tap.outputChoice];
    if (!source || !output) continue;
    if (source.requiresTap && !tapped.includes(tap.source)) {
      tapped.push(tap.source);
      // D411 - the line's price is charged HERE too (the D355 gap: an auto-paid painland dealt nothing).
      riders.push(...manaDrawbackEvents(source, tap.source, player));
    }
    for (const k of KEYS) produced[k] += output.mana[k];
    // D364 - snow mana is recorded as it is made; the source knows, the pool remembers.
    if (source.snow) for (const k of KEYS) producedSnow[k] += output.mana[k];
    const only = source.restriction;
    events.push({ t: 'ManaAdded', player, mana: output.mana, source: tap.source, snow: source.snow, ...(only ? { only } : {}) });
    if (only) {
      const at = fitting.findIndex((b) => b.restriction.text === only.text);
      fitting = at < 0 ? [...fitting, { restriction: only, mana: output.mana }] : fitting.map((b, i) => (i === at ? { restriction: b.restriction, mana: addPool(b.mana, output.mana) } : b));
    }
  }
  if (tapped.length > 0) events.push({ t: 'PermanentsTapped', cards: tapped });
  events.push(...riders);

  const concrete = hybridCombinations(setup.problem).find(
    (c) =>
      c.hybridChoices.length === plan.hybridChoices.length &&
      c.hybridChoices.every((h, i) => plan.hybridChoices[i]?.option === h.option),
  );
  // D397 - the pool MINUS the restricted mana this purpose cannot spend, as the plan was built.
  const pool = fitPool(state.players[player]?.pool ?? EMPTY_POOL, state.players[player]?.poolRestricted ?? [], purpose);
  const total: Record<ManaSymbolKey, number> = { ...produced };
  for (const k of KEYS) total[k] += pool[k];
  const spend = concrete ? spendFromPool(total as ManaPool, concrete) : null;
  if (spend) {
    // D364 - the taps have already landed in the pool by the time this spend applies,
    // so what is available as snow is the pool's own plus everything just produced.
    const poolSnow = state.players[player]?.poolSnow ?? EMPTY_POOL;
    const snowAvailable: Record<ManaSymbolKey, number> = { ...producedSnow };
    for (const k of KEYS) snowAvailable[k] += Math.min(poolSnow[k], pool[k]);
    events.push({
      t: 'ManaSpent',
      player,
      mana: spend,
      snow: snowOfSpend(spend, snowAvailable, total, concrete?.snow ?? 0),
      // D397 - restricted mana that fits is spent FIRST; the buckets it came out of, named.
      restricted: restrictedOfSpend(spend, fitting),
    });
  }
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
    includeCostly: true,
  });
  const source = sources.find(
    (s) => s.card === intent.card && s.abilityIndex === intent.abilityIndex,
  );
  if (!source) return reject('notAManaAbility', 'That permanent cannot make mana right now.');
  const output = source.outputs[intent.outputChoice];
  if (!output) return reject('notAManaAbility', 'That is not one of its mana options.');
  const card = state.cards[intent.card];
  if (source.requiresTap && card?.tapped) return reject('alreadyTapped', 'That permanent is already tapped.');
  // D397 - the price beside the {T} is an ability of THIS source: restricted mana that names
  // its kind ("activate abilities of creatures") pays it, any other restricted mana cannot.
  const self = derive(state, deps.oracle, deps.scripts, intent.card);
  const purpose = abilityPurpose(self.typeLine, self.colors);
  // D325 - the cost beside the {T}, charged at the tap: mana from the pool, life, the
  // permanent's own sacrifice. Not payable now: refused, like an unaffordable spell.
  const extra = source.extraCost ? extraCostSpend(state, intent.player, source.extraCost, purpose) : null;
  if (source.extraCost && !extra) return reject('cannotAfford', 'That mana ability has a cost you cannot pay right now.');

  const events: EventBody[] = [];
  if (source.requiresTap) events.push({ t: 'PermanentsTapped', cards: [intent.card] });
  if (extra?.mana) {
    // D364 - a mana ability's own price is paid from the pool like any other, and the
    // same rule decides which of it was snow: ordinary mana first.
    const me = state.players[intent.player];
    const poolSnow = me?.poolSnow ?? EMPTY_POOL;
    const have: Record<ManaSymbolKey, number> = { W: 0, U: 0, B: 0, R: 0, G: 0, C: 0 };
    const snowHave: Record<ManaSymbolKey, number> = { W: 0, U: 0, B: 0, R: 0, G: 0, C: 0 };
    for (const k of KEYS) {
      have[k] = me?.pool[k] ?? 0;
      snowHave[k] = poolSnow[k];
    }
    events.push({
      t: 'ManaSpent',
      player: intent.player,
      mana: extra.mana,
      snow: snowOfSpend(extra.mana, snowHave, have, 0),
      restricted: restrictedOfSpend(extra.mana, bucketsFitting(me?.poolRestricted ?? [], purpose)),
    });
  }
  if (extra && extra.life > 0) {
    const me = state.players[intent.player];
    if (me) events.push({ t: 'LifeChanged', player: intent.player, delta: -extra.life, to: me.life - extra.life });
  }
  if (source.extraCost?.sacrificeSelf && card) {
    events.push({ t: 'CardsMoved', moves: [{ card: intent.card, from: { kind: 'battlefield', player: card.controller }, to: { kind: 'graveyard', player: card.owner }, reason: 'sacrifice' }] });
  }
  // D364 - THE ONE SITE THAT DECIDES WHETHER `{S}` CAN EVER BE PAID: a permanent with
  // the Snow supertype makes snow mana, read DERIVED (a permanent can be made snow).
  // D397 - and whether it is SPEND-RESTRICTED: the mana lands in its bucket, and only a payment
  // the restriction fits ever draws on it.
  events.push({ t: 'ManaAdded', player: intent.player, mana: output.mana, source: intent.card, snow: source.snow, ...(source.restriction ? { only: source.restriction } : {}) });
  // D355 - THE PRICE THE LINE CHARGES, in the SAME accept as the mana. A mana ability does not
  // use the stack (CR 605.1), so there is no window between the two in which anything could
  // respond - and a player who taps a painland at 1 life has already lost when the mana appears.
  events.push(...manaDrawbackEvents(source, intent.card, intent.player));

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
  const name = self.name || 'a permanent';
  // D397 - the restriction is said aloud with the mana, so a pool that will not pay for the
  // next spell is never a mystery: "taps Mishra's Workshop for {C}{C}{C} (Spend this mana ...)".
  const added = costStringOf(output.mana) + (source.restriction ? ` (${source.restriction.text})` : '');
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
    // D338 - a restriction that reads the defender ("unless defending player controls an Island").
    if (!canAttackDefender(cdeps, a.card, a.defender)) {
      const name = derive(state, deps.oracle, deps.scripts, a.card, cache).name || 'That creature';
      return reject('illegalAttacker', `${name} can't attack that defender.`);
    }
    // D443 - an exert (CR 701.39) only where a script fires on it; recomputed, never read off the prompt.
    if (a.exert === true && !canExert(cdeps, a.card)) {
      const name = derive(state, deps.oracle, deps.scripts, a.card, cache).name || 'That creature';
      return reject('illegalAttacker', `${name} can't be exerted.`);
    }
  }
  // D341 - "can't attack or block alone": the only attacker declared may not be one that needs company.
  const lone = intent.attackers.length === 1 ? intent.attackers[0] : undefined;
  if (lone && mustNotAttackAlone(cdeps, lone.card)) {
    const name = derive(state, deps.oracle, deps.scripts, lone.card, cache).name || 'That creature';
    return reject('illegalAttacker', `${name} can't attack alone.`);
  }
  // D335 - CR 508.1d: a creature that attacks each combat if able, and can,
  // must be in the declaration. Recomputed here rather than read off the
  // prompt - a client's word is not a rule (D139).
  // D338 - a creature no legal defender admits is not able to attack, so no requirement asks it.
  const possible = state.zones.battlefield.filter((id) => canAttack(cdeps, id) && defenders.some((dref) => canAttackDefender(cdeps, id, dref)));
  for (const id of requiredAttackers(cdeps, possible)) {
    if (seen.has(id)) continue;
    const name = derive(state, deps.oracle, deps.scripts, id, cache).name || 'That creature';
    return reject('attackRequired', `${name} attacks each combat if able.`);
  }
  // D554 - GOAD (CR 701.15b): a goaded attacker attacks a player other than its goaders when it can.
  for (const a of intent.attackers) {
    const avoid = goadersOf(state, a.card);
    if (avoid.length === 0) continue;
    if (a.defender.kind === 'player' && !avoid.includes(a.defender.id)) continue;
    if (!defenders.some((dref) => dref.kind === 'player' && !avoid.includes(dref.id) && canAttackDefender(cdeps, a.card, dref))) continue;
    const name = derive(state, deps.oracle, deps.scripts, a.card, cache).name || 'That creature';
    return reject('illegalAttacker', `${name} is goaded - it attacks a player other than the one who goaded it.`);
  }

  const events: EventBody[] = [
    { t: 'AttackersDeclared', attackers: intent.attackers.map((a) => ({ card: a.card, defender: a.defender })) },
    { t: 'AwaitingSet', awaiting: null },
  ];
  // CR 508.1f — attacking taps the creature unless it has vigilance.
  const toTap = intent.attackers
    .map((a) => a.card)
    .filter((id) => !derive(state, deps.oracle, deps.scripts, id, cache).keywords.has('vigilance'));
  if (toTap.length > 0) events.push({ t: 'PermanentsTapped', cards: toTap });
  // D443 - CR 701.39: an exerted attacker won't untap during its controller's next untap step (D411's
  // field), and its `When you do` fires on `Exerted`.
  for (const a of intent.attackers) {
    if (a.exert !== true) continue;
    events.push({ t: 'UntapSkipSet', card: a.card, skip: true });
    events.push({ t: 'Exerted', card: a.card, player: intent.player });
    events.push(narrated(n`${who(state, intent.player)} ${vb(intent.player, 'exerts', 'exert')} ${derive(state, deps.oracle, deps.scripts, a.card, cache).name}.`, intent.player));
  }
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
  // ⚠️ The commander may have MOVED ON while the question was up: a flicker
  // exiles it (raising this choice) and returns it to the battlefield in the
  // SAME resolve, so by answer time the recorded `from` is stale. Moving from
  // the stale zone leaves the card in two zone arrays at once — fuzz seed 69
  // found exactly that (Flicker of Fate on Krenko). If the card no longer
  // sits where the queue recorded it, the question is moot and a yes does
  // nothing (CR 903.9a applies to the zone change that raised it).
  const card = state.cards[head.card];
  const still =
    !!card && card.zone.kind === head.from.kind && card.zone.player === head.from.player;
  if (intent.toCommandZone && still) {
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
  // D525 - the resolution's generator (cascade's random bottoming) rides the accept as `rngAfter`.
  const resolved = resolveAbility(state, deps, obj, intent.accept);
  return accept(
    [
      { t: 'AwaitingSet', awaiting: null },
      { t: 'OptionalTriggerAnswered', stackId: obj.id, player: intent.player, accept: intent.accept },
      ...resolved.events,
    ],
    resolved.rng,
  );
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
      { t: 'AwaitingSet', awaiting: askPromptFor(state, deps.oracle, deps.scripts, result.pending) },
    ],
  };
}

/**
 * D486 - THE CLONE'S ANSWER (CR 707.9). The held move is rewritten with the copied object's copiable values - its
 * identity fields and the copy exceptions it already carries (707.3), the face's own on top (707.9b) - or marked
 * declined, and the body runs through the whole funnel from its start, so every entry rule reads the arriving face as
 * the copy's and the copied card's enters triggers are the ones that fire. The candidates are the prompt's (the one
 * reader, re-read off the board as it stands - nothing can happen between the ask and the answer).
 */
function answerChooseCopy(
  state: GameState,
  intent: Extract<Intent, { t: 'AnswerChooseCopy' }>,
  deps: EngineDeps,
): HandleResult {
  const pending = state.pendingReplacement;
  const awaiting = state.priority.awaiting;
  if (!pending || pending.copyChoice === undefined || awaiting?.kind !== 'chooseCopy') {
    return reject('noPendingChoice', 'Nothing is waiting on a copy choice.');
  }
  if (awaiting.player !== intent.player) return reject('notYourTurn', 'That choice belongs to another player.');
  if (awaiting.source !== intent.source) return reject('notAwaitingThat', 'That is not the permanent you are being asked about.');
  if (intent.card === null && !awaiting.optional) return reject('illegalTarget', 'A copy must be chosen.');
  if (intent.card !== null && !awaiting.candidates.includes(intent.card)) return reject('illegalTarget', `That is not ${awaiting.what} the card can copy.`);
  const held = pending.event;
  if (held.t !== 'CardsMoved') return reject('noPendingChoice', 'The held event is not a move.');
  const choice = pending.copyChoice;
  const copied = intent.card === null ? undefined : state.cards[intent.card];
  const exceptions = copied ? mergeExceptions(copied.copyExceptions, choice.exceptions) : undefined;
  const moves = held.moves.map((m) =>
    m.card !== choice.card
      ? m
      : copied
        ? { ...m, asCopyOf: { oracleId: copied.oracleId, printingId: copied.printingId, faceIndex: copied.faceIndex, ...(exceptions !== undefined ? { copyExceptions: exceptions } : {}) } }
        : { ...m, copyDeclined: true as const },
  );
  const rewritten: EventBody = { ...held, moves };
  const said = narrated(
    copied ? `${awaiting.label} enters as a copy of ${derive(state, deps.oracle, deps.scripts, copied.id).name}.` : `${awaiting.label} enters as itself.`,
    intent.player,
  );
  const result = runReplacementFunnel(state, deps.oracle, deps.scripts, [rewritten, ...pending.queued]);
  // The Vesuva form: the copy enters tapped. Appended after the move it belongs to; under a further question the
  // move is still held and the tap would name a card not yet on the battlefield, so it is dropped there (no
  // printed card meets both).
  const tap: EventBody[] = copied && choice.tapped ? [{ t: 'PermanentsTapped', cards: [choice.card] }] : [];
  if (result.kind === 'done') {
    return { ok: true, funnelled: true, events: [{ t: 'ReplacementResolved' }, { t: 'AwaitingSet', awaiting: null }, said, ...result.events, ...tap] };
  }
  return {
    ok: true,
    funnelled: true,
    events: [
      { t: 'ReplacementResolved' },
      said,
      ...result.settled,
      { t: 'ReplacementPending', pending: result.pending },
      { t: 'AwaitingSet', awaiting: askPromptFor(state, deps.oracle, deps.scripts, result.pending) },
    ],
  };
}

/** D527 - the player chosen at resolution (a clash's opponent): the pick must be a candidate, and the clash begins with it. */
function answerChoosePlayer(state: GameState, intent: Extract<Intent, { t: 'AnswerChoosePlayer' }>, deps: EngineDeps): HandleResult {
  const awaiting = state.priority.awaiting;
  if (awaiting?.kind !== 'choosePlayer') return reject('noPendingChoice', 'Nothing is waiting for a player.');
  if (awaiting.player !== intent.player) return reject('notYourTurn', 'That choice is not yours to make.');
  if (!awaiting.candidates.includes(intent.chosen)) return reject('illegalTarget', 'That player is not one you may choose.');
  const events: EventBody[] = [
    { t: 'AwaitingSet', awaiting: null },
    narrated(n`${who(state, intent.player)} ${vb(intent.player, 'chooses', 'choose')} ${who(state, intent.chosen)} for ${awaiting.label}.`, intent.player),
  ];
  let scratch = state;
  for (const body of events) scratch = apply(scratch, { seq: scratch.eventCount, body, cause: { kind: 'system' } } as never);
  events.push(...clashBegin(scratch, deps, intent.player, intent.chosen, awaiting.label));
  const decided = events.find((e) => e.t === 'Clashed');
  const carried = decided !== undefined && decided.t === 'Clashed' && awaiting.continuation !== undefined ? { ...awaiting.continuation, clash: decided.won ? ('won' as const) : ('lost' as const) } : awaiting.continuation;
  return accept(events, resumeContinuation(state, deps, events, carried));
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

/**
 * D465 - the creature-type twin of `answerChooseColor`. The catalogue is the oracle catalogue
 * (`creatureTypes`, the changeling list, D310): a name outside it is REFUSED with a message
 * rather than stored, because every consumer compares it against derived subtypes and a
 * misspelling would be a permanent that quietly applies to nothing.
 */
function answerChooseCreatureType(
  state: GameState,
  intent: Extract<Intent, { t: 'AnswerChooseCreatureType' }>,
  deps: EngineDeps,
): HandleResult {
  const awaiting = state.priority.awaiting;
  if (awaiting?.kind !== 'chooseCreatureType') {
    return reject('noPendingChoice', 'Nothing is waiting for a creature type.');
  }
  if (awaiting.player !== intent.player) {
    return reject('notYourTurn', 'That choice is not yours to make.');
  }
  if (!deps.oracle.creatureTypes.has(intent.creatureType)) {
    return reject('notACreatureType', `${intent.creatureType} is not a creature type.`);
  }
  return {
    ok: true,
    events: [
      { t: 'CreatureTypeChosen', card: awaiting.source, creatureType: intent.creatureType },
      narrated(
        n`${who(state, intent.player)} ${vb(intent.player, 'names', 'name')} ${intent.creatureType} for ${awaiting.label}.`,
        intent.player,
      ),
      { t: 'AwaitingSet', awaiting: null },
    ],
  };
}

/**
 * D369 - the payment prompt answered. Paying is validated and charged exactly as turning a
 * morph face up is (D309): the client's plan or the host's suggestion, the same validator,
 * the same `payEvents`. The decided branch then runs over the object the prompt
 * snapshotted, on a SCRATCH state that has already paid (the scry answer's fold, D195), so
 * a branch that reads life or the pool reads them after the price.
 *
 * THE LIFE IS RE-CHECKED HERE (D136's rule) and an unaffordable yes is REFUSED with a
 * message rather than downgraded to "no": the player asked to pay.
 */
function answerPayMana(
  state: GameState,
  intent: Extract<Intent, { t: 'AnswerPayMana' }>,
  deps: EngineDeps,
): HandleResult {
  const awaiting = state.priority.awaiting;
  if (awaiting?.kind !== 'payMana' || awaiting.player !== intent.player) {
    return reject('notAwaitingThat', 'You are not being asked to pay for anything.');
  }
  const events: EventBody[] = [
    { t: 'AwaitingSet', awaiting: null },
    { t: 'PaymentAnswered', player: intent.player, paid: intent.pay, label: awaiting.label, ...(awaiting.verbs ? { verb: awaiting.verbs.costText } : {}) },
  ];
  if (intent.pay && awaiting.verbs) {
    // D415 - a VERB price: the picks ARE the payment, checked against the board as it stands now.
    const charged = verbPriceEvents(state, deps, intent.player, awaiting, awaiting.verbs, intent.picks ?? []);
    if ('error' in charged) return charged.error;
    // D545 - an EXPLOIT's sacrifice carries its exploiter (CR 702.110b): the move the `exploits a creature` head reads.
    const exploiter = awaiting.exploit === true ? awaiting.source : null;
    events.push(...(exploiter === null ? charged.events : charged.events.map((e) => (e.t === 'CardsMoved' ? { ...e, moves: e.moves.map((m) => ({ ...m, exploitedBy: exploiter })) } : e))));
    events.push(narrated(n`${who(state, intent.player)} ${vb(intent.player, 'pays', 'pay')} for ${awaiting.label}: ${awaiting.verbs.costText}.`, intent.player));
  } else if (intent.pay) {
    const seat = state.players[intent.player];
    if (awaiting.life > 0 && (!seat || seat.life < awaiting.life)) {
      return reject('cannotAfford', `You do not have ${awaiting.life} life to pay.`);
    }
    // D519 - the energy price (CR 122.1): charged from the counters held, refused short of them.
    const energyAsked = awaiting.energy ?? 0;
    if (energyAsked > 0 && (!seat || seat.energy < energyAsked)) {
      return reject('cannotAfford', `You do not have ${energyAsked} energy to pay.`);
    }
    if (energyAsked > 0 && seat) events.push({ t: 'EnergyChanged', player: intent.player, delta: -energyAsked, to: seat.energy - energyAsked });
    const problem = buildPaymentProblem(awaiting.cost, 0, [], 0, awaiting.life);
    // D397 - a payment prompt is neither a spell nor an ability: restricted mana never pays it.
    const chosen = intent.plan ?? suggestPayment(solveInputFor(state, deps.oracle, deps.scripts, intent.player), problem, OTHER_PURPOSE);
    if (!chosen) return reject('cannotAfford', `You cannot pay ${awaiting.cost?.raw ?? ''} for ${awaiting.label}.`);
    const verdict = validatePlan(state, deps.oracle, deps.scripts, intent.player, problem, chosen, OTHER_PURPOSE);
    if (verdict === 'stale') return reject('stalePaymentPlan', 'The board changed while you were paying. Try again.');
    if (verdict === 'invalid') return reject('invalidPaymentPlan', 'That payment does not cover the cost.');
    events.push(...payEvents(state, deps, intent.player, chosen, { problem }, OTHER_PURPOSE));
    events.push(narrated(n`${who(state, intent.player)} ${vb(intent.player, 'pays', 'pay')} ${awaiting.cost?.raw ?? ''}${awaiting.life > 0 ? ` and ${String(awaiting.life)} life` : ''} for ${awaiting.label}.`, intent.player));
  } else {
    events.push(narrated(n`${who(state, intent.player)} ${vb(intent.player, 'does', 'do')} not pay for ${awaiting.label}.`, intent.player));
  }
  const branch = intent.pay ? awaiting.ifPaid : awaiting.ifNotPaid;
  if (branch.length > 0) {
    let scratch = state;
    for (const body of events) scratch = apply(scratch, { seq: scratch.eventCount, body, cause: { kind: 'system' } } as never);
    const obj: StackObject = {
      id: 'pay',
      kind: awaiting.card ? 'spell' : 'triggered',
      controller: awaiting.controller,
      card: awaiting.card,
      source: awaiting.source,
      abilityRef: null,
      targets: awaiting.targets,
      ...(awaiting.targetSlots !== undefined ? { targetSlots: awaiting.targetSlots } : {}),
      modes: [],
      xValue: null,
      label: awaiting.label,
      identity: awaiting.identity,
      taxApplied: 0,
      isCommanderCast: false,
      castFrom: null,
      faceIndex: 0,
    };
    events.push(...effectResult(scratch, deps, obj, branch).events);
  }
  // D484 - the clauses after the payment, once the branch has landed (a branch that asked carries them on its question).
  return accept(events, resumeContinuation(state, deps, events, awaiting.continuation));
}

/**
 * D415 - THE VERB PRICE, charged. The picks must be exactly the printed count, distinct, and each a
 * candidate against the board as it stands NOW (`castCostCandidates` - the list that decided the
 * question was worth asking, D139), or the object's own sacrifice; the cost batch's own shapes then
 * move them (`additionalCostEvents`, D406), so the watchers see an ordinary sacrifice, discard, tap,
 * exile or return. An unaffordable yes is REFUSED with a message, never downgraded to a no (D136).
 */
function verbPriceEvents(
  state: GameState,
  deps: EngineDeps,
  player: PlayerId,
  awaiting: Extract<NonNullable<GameState['priority']['awaiting']>, { kind: 'payMana' }>,
  verbs: VerbPrice,
  picks: readonly InstanceId[],
): { events: EventBody[] } | { error: HandleResult } {
  if (new Set(picks).size !== picks.length) return { error: reject('noSuchCard', 'You named the same card twice.') };
  const self = awaiting.source ?? awaiting.card ?? '';
  if (verbs.sacrificeSelf) {
    const inst = self === '' ? undefined : state.cards[self];
    if (!inst || inst.zone.kind !== 'battlefield') return { error: reject('cannotAfford', `${awaiting.label}: there is nothing left to sacrifice.`) };
    if (picks.length > 0 && (picks.length !== 1 || picks[0] !== self)) return { error: reject('illegalSacrifice', `${awaiting.label}'s price is its own sacrifice.`) };
    return additionalCostEvents(state, deps, player, awaiting.identity, picksOf({ sacrifice: [self] }));
  }
  const cache = makeDeriveCache(state);
  const cand = castCostCandidates(state, (cid) => derive(state, deps.oracle, deps.scripts, cid, cache), player, self, verbs);
  const VERBS = [
    [verbs.sacrificeCost, 'sacrificeCandidates', 'needsSacrifice', 'illegalSacrifice', 'sacrifice'],
    [verbs.discardCost, 'discardCandidates', 'needsDiscard', 'illegalDiscard', 'discard'],
    [verbs.tapCost, 'tapCandidates', 'needsTap', 'illegalTap', 'tap'],
    [verbs.exileFromGraveyardCost, 'exileFromGraveyardCandidates', 'needsExileFromGraveyard', 'illegalExileFromGraveyard', 'exileFromGraveyard'],
    [verbs.returnCost, 'returnCandidates', 'needsReturn', 'illegalReturn', 'returnToHand'],
  ] as const;
  for (const [cost, key, needs, illegal, field] of VERBS) {
    if (cost === null) continue;
    if (picks.length !== cost.count) return { error: reject(needs, `${awaiting.label}: ${verbs.costText} - name ${cost.count}.`) };
    const legal = (cand.fields[key] ?? []) as readonly InstanceId[];
    if (!cand.enough || !picks.every((c) => legal.includes(c))) return { error: reject(illegal, `Those cannot pay ${awaiting.label}'s price (${verbs.costText}).`) };
    return additionalCostEvents(state, deps, player, awaiting.identity, picksOf({ [field]: picks }));
  }
  return { error: reject('cannotAfford', `${awaiting.label}: a price the app cannot charge.`) };
}

/** D441 - the printed name of a hand card a reveal land shows. */
function revealedName(state: GameState, deps: EngineDeps, id: InstanceId): string {
  const inst = state.cards[id];
  const printing = inst ? deps.oracle.byPrinting(inst.printingId) : undefined;
  return inst && printing ? faceOf(printing, inst.faceIndex).name : 'a card';
}

function answerEntersChoice(
  state: GameState,
  intent: Extract<Intent, { t: 'AnswerEntersChoice' }>,
  deps: EngineDeps,
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
  if (intent.pay && awaiting.reveal === undefined && (!seat || seat.life < awaiting.life)) {
    return reject('cannotAfford', `You do not have ${awaiting.life} life to pay.`);
  }
  // D441 - a reveal price: the answer names a card of the answerer's hand the noun admits (the printed face, the one
  // reader). The card is shown to every seat and the permanent enters untapped; nothing else moves.
  if (intent.pay && awaiting.reveal !== undefined) {
    const shown = intent.reveal;
    if (shown === undefined || !(state.zones.hand[intent.player] ?? []).includes(shown)) {
      return reject('noSuchCard', 'Name a card in your hand to reveal.');
    }
    if (!revealAdmits(state, deps.oracle, shown, awaiting.reveal.any)) {
      return reject('noSuchCard', `That card is not a ${awaiting.reveal.text} card.`);
    }
  }

  const events: EventBody[] = [
    { t: 'EntersChoiceAnswered', card: awaiting.source, player: intent.player, pay: intent.pay },
  ];
  // D444 - an entry choice: `pay` is the +1/+1 counter (unleash and riot alike); declined, unleash takes nothing
  // and riot takes haste. Neither branch taps - the tap is the life price's decline only.
  if (awaiting.option !== undefined) {
    if (intent.pay) {
      events.push({ t: 'CountersChanged', changes: [{ card: awaiting.source, kind: '+1/+1', delta: 1 }] });
      events.push(narrated(n`${awaiting.label} enters with a +1/+1 counter.`, intent.player));
    } else if (awaiting.option === 'riot') {
      events.push({ t: 'HasteChosen', card: awaiting.source });
      events.push(narrated(n`${awaiting.label} enters with haste.`, intent.player));
    } else {
      events.push(narrated(n`${awaiting.label} enters without a counter.`, intent.player));
    }
  } else if (intent.pay && awaiting.reveal !== undefined && intent.reveal !== undefined) {
    events.push({ t: 'CardsRevealed', cards: [intent.reveal], to: state.seating });
    events.push(
      narrated(
        n`${who(state, intent.player)} ${vb(intent.player, 'reveals', 'reveal')} ${revealedName(state, deps, intent.reveal)} for ${awaiting.label}.`,
        intent.player,
      ),
    );
  } else if (intent.pay) {
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
          ...(next.reveal !== undefined ? { reveal: next.reveal } : {}),
          ...(next.option !== undefined ? { option: next.option } : {}),
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

/**
 * D357 - CR 701.19. The searcher names the cards they found; the handler checks each against the
 * predicate and against their OWN library, moves them, clears the reveal and shuffles.
 *
 * ⚠️ EVERY CHECK IS HERE, because the prompt vouches for nothing (D137's rule): the cards must be
 * in that player's library, must match the printed predicate, must not repeat, and must not exceed
 * the count. Zero is always accepted.
 *
 * ⚠️ THE REVEAL IS CLEARED BEFORE THE SHUFFLE. A library still revealed to its owner after a search
 * would keep feeding `view.searching` - and worse, once the prompt is gone `peek` walks it again
 * and hands back the order. The clear is what restores the invariant.
 */
function answerSearchLibrary(
  state: GameState,
  intent: Extract<Intent, { t: 'AnswerSearchLibrary' }>,
  deps: EngineDeps,
): HandleResult {
  const awaiting = state.priority.awaiting;
  if (awaiting?.kind !== 'searchLibrary' || awaiting.player !== intent.player) {
    return reject('notAwaitingThat', 'You are not searching a library.');
  }
  /**
   * D359 - STAGE ONE. While the prompt is `optional` nothing has been revealed, so the only
   * answers it takes are yes and no, and cards would name a library the player cannot see.
   *
   * ⚠️ **DECLINING IS NOT FINDING NOTHING.** Declining looks at nothing and shuffles nothing;
   * finding nothing looked and still shuffles. Both are legal answers to different questions
   * (CR 701.19b for the second), and the difference is visible in the seeded generator, so the
   * two are kept apart all the way down rather than collapsed into an empty answer.
   */
  if (awaiting.optional) {
    if (intent.cards.length > 0) {
      return reject('noSuchCard', 'You have not looked at your library yet.');
    }
    if (intent.declined) {
      // D484 - declining the offer still runs what follows the search.
      const declined: EventBody[] = [{ t: 'AwaitingSet', awaiting: null }];
      return accept(declined, resumeContinuation(state, deps, declined, awaiting.continuation));
    }
    const all = state.zones.library[intent.player] ?? [];
    return accept([
      { t: 'CardsRevealed', cards: all, to: [intent.player] },
      { t: 'AwaitingSet', awaiting: { ...awaiting, optional: false } },
    ]);
  }
  if (intent.declined) {
    return reject('notAwaitingThat', 'This search is not optional.');
  }
  if (intent.cards.length > awaiting.count) {
    return reject('invalidAmount', `Choose at most ${awaiting.count} card${awaiting.count === 1 ? '' : 's'}.`);
  }
  const unique = new Set(intent.cards);
  if (unique.size !== intent.cards.length) {
    return reject('noSuchCard', 'You named the same card twice.');
  }
  const lib = state.zones.library[intent.player] ?? [];
  // D483 - a two-zone search names a card in the library OR the searcher's graveyard (public); it moves from where it is.
  const gy = awaiting.graveyardToo === true ? (state.zones.graveyard[intent.player] ?? []) : [];
  for (const card of intent.cards) {
    if (!lib.includes(card) && !gy.includes(card)) return reject('wrongZone', awaiting.graveyardToo === true ? 'That card is not in your library or graveyard.' : 'That card is not in your library.');
    if (!cardMatchesSearch(state, deps, card, awaiting.predicates, awaiting.qualifier)) {
      return reject('illegalTarget', `That card is not ${awaiting.what}.`);
    }
  }

  const events: EventBody[] = [];
  /**
   * D359 - THE TUTOR MOVES NOTHING. `then shuffle and put that card on top` shuffles the
   * library and puts the found card back on top of it, in that order, and the card is in the
   * library the whole time. One `LibraryShuffled` order says all of it: the array is
   * BOTTOM-FIRST, so the found card is last.
   *
   * ⚠️ Its reveal is NOT cleared. The searcher is entitled to know what they put on top - that
   * is the entire effect of a tutor - and `view.peek` reads exactly the revealed run from the
   * top, which is the one card.
   */
  if (awaiting.destination === 'libraryTop') {
    const rest = lib.filter((id) => !unique.has(id));
    if (rest.length > 0) events.push({ t: 'RevealCleared', cards: rest });
    events.push({ t: 'AwaitingSet', awaiting: null });
    const mixed = shuffle(state.rng, rest);
    events.push({
      t: 'LibraryShuffled',
      player: intent.player,
      order: [...mixed.value, ...intent.cards],
    });
    return accept(events, resumeContinuation(state, deps, events, awaiting.continuation, mixed.next));
  }
  if (intent.cards.length > 0) {
    const to =
      awaiting.destination === 'hand'
        ? { kind: 'hand' as const, player: intent.player }
        : awaiting.destination === 'graveyard'
          ? { kind: 'graveyard' as const, player: intent.player }
          : { kind: 'battlefield' as const, player: intent.player };
    events.push({
      t: 'CardsMoved',
      moves: intent.cards.map((card) => ({
        card,
        from: gy.includes(card) ? { kind: 'graveyard' as const, player: intent.player } : { kind: 'library' as const, player: intent.player },
        to,
      })),
    });
    // ⚠️ Tapped is a SEPARATE event rather than a flag on the move: the card enters through the
    // ordinary funnel first, so D134's own "enters tapped" and D107's counters still run on it.
    if (awaiting.tapped && awaiting.destination === 'battlefield') {
      events.push({ t: 'PermanentsTapped', cards: [...intent.cards] });
    }
  }
  // The reveal is cleared over the WHOLE library, not just the cards taken.
  const stillThere = lib.filter((id) => !unique.has(id));
  if (stillThere.length > 0) events.push({ t: 'RevealCleared', cards: stillThere });
  events.push({ t: 'AwaitingSet', awaiting: null });

  if (!awaiting.shuffle) return accept(events, resumeContinuation(state, deps, events, awaiting.continuation));
  // ⚠️ The SEEDED generator, the only randomness this engine has, and the shuffle is over what is
  // left after the move - shuffling the pre-move library would put the found card back.
  const shuffled = shuffle(state.rng, stillThere);
  events.push({ t: 'LibraryShuffled', player: intent.player, order: shuffled.value });
  return accept(events, resumeContinuation(state, deps, events, awaiting.continuation, shuffled.next));
}

/**
 * D357 - does a card in a library match a printed search predicate? Asked of the ORACLE face,
 * because a card in a library has no derived characteristics - nothing is applying continuous
 * effects to it.
 */
function cardMatchesSearch(
  state: GameState,
  deps: EngineDeps,
  card: InstanceId,
  predicates: readonly PermanentPredicate[],
  qualifier: SearchQualifier | null,
): boolean {
  const inst = state.cards[card];
  if (!inst) return false;
  const printing = deps.oracle.byPrinting(inst.printingId);
  if (!printing) return false;
  const face = faceOf(printing, 0);
  /**
   * D359 - the qualifier is a CONJUNCT over the whole noun, not one more alternative:
   * `a Rebel permanent card with mana value 2 or less` is one thing with a bound on it, and a
   * reader that treated the bound as an `or` would fetch any Rebel at all.
   *
   * The NAME is matched against the whole printed card name rather than a face, because that is
   * what `named` means in the rules (CR 201.2) - a modal double-faced card is named by its
   * front face's full name, which is the name the printing carries.
   */
  if (qualifier) {
    if (qualifier.name !== null && printing.name.toLowerCase() !== qualifier.name.toLowerCase()) {
      return false;
    }
    const mv = qualifier.manaValue;
    if (mv) {
      const value = printing.manaValue;
      if (mv.op === 'lte' && !(value <= mv.n)) return false;
      if (mv.op === 'gte' && !(value >= mv.n)) return false;
      if (mv.op === 'eq' && value !== mv.n) return false;
    }
  }
  // D389 - the one reader the bot, the harness, the fuzz driver and the peek panel also ask.
  return predicateAdmits(face, predicates);
}

/**
 * D390 - carry the player queue one answer further. The answering player's picks are recorded;
 * every player next in line with no real choice is recorded too, without a prompt; the first with
 * one is asked; and when nobody is left the queue clears and every pick moves in ONE batch.
 */
function advanceAsks(state: GameState, deps: EngineDeps, player: PlayerId, cards: readonly InstanceId[]): HandleResult {
  const pending = state.pendingAsks;
  if (pending === null) return reject('notAwaitingThat', 'No question is queued for that answer.');
  // D484 - the clauses after the queue's sentence ride the question being answered: the next player's takes them on, the batch runs them.
  const carried = state.priority.awaiting?.kind === 'chooseFromZone' ? state.priority.awaiting.continuation : undefined;
  const chosen = [...pending.chosen, { player, cards }];
  const remaining = [...pending.remaining];
  while (remaining.length > 0) {
    const next = remaining[0];
    if (next === undefined) break;
    const cands = askCandidates(state, deps, next, pending.verb, pending.filter);
    if (cands.length > pending.count) {
      const after = { ...pending, remaining: remaining.slice(1), chosen };
      return accept([
        { t: 'AsksQueued', pending: after },
        {
          t: 'AwaitingSet',
          awaiting: {
            kind: 'chooseFromZone',
            player: next,
            zone: pending.verb === 'discard' ? 'hand' : 'battlefield',
            rest: null,
            count: pending.count,
            ...(pending.optional === true ? { min: 0 } : {}),
            ...(pending.filter ? { filter: pending.filter } : {}),
            ...(pending.verb === 'bolster' ? { pick: 'leastToughness' as const } : pending.verb === 'amass' ? { pick: 'army' as const } : pending.verb === 'ringBearer' ? { pick: 'ringBearer' as const } : {}),
            label: pending.label,
            ...(carried !== undefined ? { continuation: carried } : {}),
          },
        },
      ]);
    }
    chosen.push({ player: next, cards: cands });
    remaining.shift();
  }
  const batch: EventBody[] = [{ t: 'AwaitingSet', awaiting: null }, { t: 'AsksResolved', verb: pending.verb }, ...askBatch(state, deps, pending.verb, chosen, pending.filter, pending.amount, pending.subtype)];
  return accept(batch, resumeContinuation(state, deps, batch, carried));
}

function answerChooseFromZone(
  state: GameState,
  intent: Extract<Intent, { t: 'AnswerChooseFromZone' }>,
  deps: EngineDeps,
): HandleResult {
  const awaiting = state.priority.awaiting;
  if (awaiting?.kind !== 'chooseFromZone' || awaiting.player !== intent.player) {
    return reject('notAwaitingThat', 'You are not being asked to choose cards.');
  }
  // D389 - `min` is the fewest a look with "you may" takes; every older prompt is exact.
  const min = awaiting.min ?? awaiting.count;
  if (intent.cards.length > awaiting.count || intent.cards.length < min) {
    return reject(
      'invalidAmount',
      min === awaiting.count
        ? `Choose exactly ${awaiting.count} card${awaiting.count === 1 ? '' : 's'}.`
        : `Choose up to ${awaiting.count} card${awaiting.count === 1 ? '' : 's'}.`,
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
      // D389 - the look's FILTER, asked of the oracle face the way a search's noun is (D357).
      if (awaiting.filter && !cardMatchesSearch(state, deps, card, awaiting.filter.predicates, null)) {
        return reject('illegalTarget', `That card is not ${awaiting.filter.what}.`);
      }
      // D493 - the noun's negations (`noncreature, nonland`): the types the pick must lack.
      if (awaiting.none !== undefined && awaiting.none.length > 0) {
        const inst = state.cards[card];
        const printing = inst ? deps.oracle.byPrinting(inst.printingId) : undefined;
        if (printing && awaiting.none.some((t) => faceOf(printing, 0).typeLine.types.includes(t))) return reject('illegalTarget', `That card is not one the look admits.`);
      }
    }
    const rest = shown.filter((id) => !unique.has(id));
    // D389 - "in a random order": the leftovers are shuffled HERE, off the seeded generator, and
    // the advanced state rides the accept (D147's `rngAfter` rule: a caller that dropped it would
    // replay to a different bottom than it played). Only now are the leftovers known at all.
    const mixed = awaiting.rest === 'random' ? shuffle(state.rng, rest) : null;
    const bottomed = mixed ? mixed.value : rest;
    const took = intent.cards.length === 0 ? 'nothing' : `${intent.cards.length} card${intent.cards.length === 1 ? '' : 's'}`;
    // D493 - the picks go where the line sends them: the hand, or the battlefield (tapped when the line says so).
    // D526 - a manifest dread's pick enters face down, manifested (CR 701.34e); the marker names the dread.
    const manifests = awaiting.to === 'battlefield' && awaiting.faceDown === true;
    const toHand = intent.cards.map((card) => ({
      card,
      from: { kind: 'library' as const, player: intent.player },
      to: awaiting.to === 'battlefield' ? { kind: 'battlefield' as const, player: intent.player } : { kind: 'hand' as const, player: intent.player },
      ...(manifests ? { faceDown: true, manifested: true as const } : {}),
    }));
    const dreadMarks: EventBody[] = manifests ? intent.cards.map((card) => ({ t: 'ManifestedDread' as const, player: intent.player, card })) : [];
    const tappedAfter: EventBody[] = awaiting.to === 'battlefield' && awaiting.tapped === true && intent.cards.length > 0 ? [{ t: 'PermanentsTapped', cards: [...intent.cards] }] : [];
    /**
     * ⚠️ The leftovers go to the BOTTOM, which is the FRONT of the array —
     * `drawFromTop` takes from the end, so "bottom" is index 0. A move that got
     * this backwards would put the cards the player just declined straight back
     * under their next draw.
     */
    // D493 - `top`: the leftovers stay where they are (no move at all); `hand`: they go into the hand.
    const toRest = (awaiting.rest === 'top' ? [] : bottomed).map((card) =>
      awaiting.rest === 'graveyard'
        ? {
            card,
            from: { kind: 'library' as const, player: intent.player },
            to: { kind: 'graveyard' as const, player: state.cards[card]?.owner ?? intent.player },
          }
        : awaiting.rest === 'hand'
        ? {
            card,
            from: { kind: 'library' as const, player: intent.player },
            to: { kind: 'hand' as const, player: intent.player },
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
            ...(awaiting.continuation !== undefined ? { continuation: awaiting.continuation } : {}),
          },
        },
        { t: 'CardsMoved', moves: toHand },
        ...tappedAfter,
        ...dreadMarks,
        narrated(
          n`${who(state, intent.player)} ${vb(intent.player, 'takes', 'take')} ${took}.`,
          intent.player,
        ),
      ]);
    }

    const where =
      awaiting.rest === 'graveyard'
        ? 'into the graveyard'
        : awaiting.rest === 'random'
          ? 'on the bottom in a random order'
          : awaiting.rest === 'top'
            ? 'back on top'
            : awaiting.rest === 'hand'
              ? 'into the hand'
              : 'on the bottom';
    const events: EventBody[] = [
      { t: 'AwaitingSet', awaiting: null },
      ...(toHand.length + toRest.length > 0 ? [{ t: 'CardsMoved' as const, moves: [...toHand, ...toRest] }] : []),
      ...tappedAfter,
      ...dreadMarks,
      // ⚠️ The reveal is CLEARED, or the player keeps seeing the cards that went
      // to the bottom for the rest of the game — `view.peek` reads `revealedTo`.
      { t: 'CardsRevealed', cards: [...shown], to: [] },
      narrated(
        n`${who(state, intent.player)} ${vb(intent.player, 'takes', 'take')} ${took} and ${vb(intent.player, 'puts', 'put')} ${rest.length} ${where}.`,
        intent.player,
      ),
    ];
    return accept(events, resumeContinuation(state, deps, events, awaiting.continuation, mixed === null ? undefined : mixed.next));
  }

  /**
   * D390 - a queued SACRIFICE: the picks are the player's own permanents the printed noun admits
   * (DERIVED, exactly the list the offer was made from), and the queue decides what follows - the
   * next player's question, or the whole batch at once.
   */
  if (awaiting.zone === 'battlefield') {
    // D431 - the queue's own verb (a return reads the same board as a sacrifice).
    const legal = askCandidates(state, deps, intent.player, state.pendingAsks?.verb ?? 'sacrifice', awaiting.filter ?? null);
    // D510 - an `up to` choice (the untap verb) may name fewer than the count, down to none - `min` 0 rode the prompt.
    for (const card of intent.cards) {
      if (!legal.includes(card)) return reject('illegalTarget', `That is not ${awaiting.filter ? 'a ' + awaiting.filter.what : 'a permanent'} you control.`);
    }
    return advanceAsks(state, deps, intent.player, intent.cards);
  }

  // D416 - THE HAND REVEAL'S PICK: one card of the OWNER's revealed hand the noun admits (re-asked of the
  // card as printed), which the owner discards (CR 701.8 - the owner's own discard, so the discard
  // watchers see it as one) or which is exiled; then the chooser's life loss, when the card printed one.
  if (awaiting.owner !== undefined) {
    const owner = awaiting.owner;
    const theirs = state.zones.hand[owner] ?? [];
    const bound = { none: awaiting.none ?? [], filter: awaiting.filter ?? null, qualifier: awaiting.qualifier ?? null };
    for (const card of intent.cards) {
      if (!theirs.includes(card)) return reject('wrongZone', 'That card is not in their hand.');
      if (!handChoiceAdmits(state, deps.oracle, card, bound)) return reject('illegalTarget', `That card is not ${awaiting.filter?.what ?? 'one the card lets you choose'}.`);
    }
    const exile = awaiting.then === 'exile';
    const moves = intent.cards.map((card) => ({
      card,
      from: { kind: 'hand' as const, player: owner },
      to: exile ? { kind: 'exile' as const, player: state.cards[card]?.owner ?? owner } : { kind: 'graveyard' as const, player: state.cards[card]?.owner ?? owner },
      ...(exile ? {} : { reason: 'discard' as const }),
    }));
    const named = intent.cards.map((card) => { const inst = state.cards[card]; const p = inst ? deps.oracle.byPrinting(inst.printingId) : undefined; return p ? faceOf(p, inst?.faceIndex ?? 0).name : 'a card'; }).join(', ');
    const events: EventBody[] = [
      { t: 'AwaitingSet', awaiting: null },
      { t: 'CardsMoved', moves },
      narrated(n`${who(state, intent.player)} ${vb(intent.player, 'chooses', 'choose')} ${named}; ${who(state, owner)} ${exile ? vb(owner, 'exiles', 'exile') : vb(owner, 'discards', 'discard')} it.`, intent.player),
    ];
    // D418 - the reveal is cleared over what STAYS in the hand (the library rule, D357): the table keeps the names
    // the narration gave it, not a standing window into the hand.
    const stays = theirs.filter((c) => !intent.cards.includes(c));
    if (stays.length > 0) events.push({ t: 'RevealCleared', cards: stays });
    if (awaiting.loseLife !== undefined && awaiting.loseLife > 0) { const p = state.players[intent.player]; if (p) events.push({ t: 'LifeChanged', player: intent.player, delta: -awaiting.loseLife, to: p.life - awaiting.loseLife }); }
    return accept(events, resumeContinuation(state, deps, events, awaiting.continuation));
  }
  // D525 - a prompt with a POOL (cascade's exiled candidate) is answered from the pool, not the hand.
  const hand = awaiting.pool !== undefined ? [...awaiting.pool] : (state.zones.hand[intent.player] ?? []);
  for (const card of intent.cards) {
    if (!hand.includes(card)) return reject('wrongZone', awaiting.pool !== undefined ? 'That card is not one you may cast.' : 'That card is not in your hand.');
  }
  // D508 - THE HAND PUT: the picks the printed noun admits (D416's reader - the negations, the filter) leave the hand
  // for the battlefield under the chooser's control (tapped when the line says so), named first by the marker the
  // fuzz counts; an empty answer puts nothing and the effect goes on. The move is an ordinary entry, so the entry
  // funnel and the enters triggers run for the permanents as for a look's battlefield pick (D493).
  if (awaiting.zone === 'hand' && awaiting.to === 'battlefield') {
    const bound = { none: awaiting.none ?? [], filter: awaiting.filter ?? null, qualifier: awaiting.qualifier ?? null };
    for (const card of intent.cards) {
      if (!handChoiceAdmits(state, deps.oracle, card, bound)) return reject('illegalTarget', `That card is not ${awaiting.filter?.what ?? 'one the card lets you put onto the battlefield'}.`);
    }
    const events: EventBody[] = [{ t: 'AwaitingSet', awaiting: null }];
    if (intent.cards.length === 0) {
      events.push(narrated(n`${who(state, intent.player)} ${vb(intent.player, 'puts', 'put')} nothing onto the battlefield for ${awaiting.label}.`, intent.player));
    } else {
      events.push({ t: 'PutFromHand', player: intent.player, cards: [...intent.cards] });
      events.push({ t: 'CardsMoved', moves: intent.cards.map((card) => ({ card, from: { kind: 'hand' as const, player: intent.player }, to: { kind: 'battlefield' as const, player: intent.player }, ...(awaiting.faceDown === true ? { faceDown: true, manifested: true as const } : {}) })) });
      if (awaiting.tapped === true) events.push({ t: 'PermanentsTapped', cards: [...intent.cards] });
    }
    return accept(events, resumeContinuation(state, deps, events, awaiting.continuation));
  }
  // D491 - THE FROM-HAND FREE CAST: an empty answer casts nothing and the granting effect goes on; a pick the bound
  // admits (D416's reader plus castability, `freeCastAdmits`) BEGINS ITS CAST with nothing to pay - the cast's own
  // questions next, the granting effect's rest riding the pending cast.
  if (awaiting.castFree === true) {
    if (intent.cards.length === 0) {
      const declined: EventBody[] = [{ t: 'AwaitingSet', awaiting: null }];
      // D525 - cascade's declined candidate goes to the bottom of the library with the rest, its permission gone.
      if (awaiting.pool !== undefined && awaiting.pool.length > 0) {
        const still = awaiting.pool.filter((card) => state.cards[card]?.zone.kind === 'exile');
        // D541 - a madness card declined goes to its owner's graveyard (CR 702.35a).
        if (still.length > 0 && awaiting.madness !== undefined) declined.push({ t: 'CardsMoved', moves: still.map((card) => ({ card, from: { kind: 'exile' as const, player: state.cards[card]?.owner ?? intent.player }, to: { kind: 'graveyard' as const, player: state.cards[card]?.owner ?? intent.player } })) });
        // D538 - a rebound card declined at the upkeep stays in exile (`declineStays`); its permission still goes.
        else if (still.length > 0 && awaiting.declineStays !== true) declined.push({ t: 'CardsMoved', moves: still.map((card) => ({ card, from: { kind: 'exile' as const, player: state.cards[card]?.owner ?? intent.player }, to: { kind: 'library' as const, player: state.cards[card]?.owner ?? intent.player }, placement: 'bottom' as const })) });
        declined.push({ t: 'PlayPermissionsExpired', cards: [...awaiting.pool] });
      }
      declined.push(narrated(n`${who(state, intent.player)} ${vb(intent.player, 'casts', 'cast')} nothing for ${awaiting.label}.`, intent.player));
      return accept(declined, resumeContinuation(state, deps, declined, awaiting.continuation));
    }
    const pick = intent.cards[0];
    if (pick === undefined) return reject('noSuchCard', 'Name the card to cast.');
    // D541 - a prompt with a POOL (cascade's, rebound's, madness's exiled card) is answered from the pool - never a card of the hand.
    if (awaiting.pool !== undefined && !awaiting.pool.includes(pick)) return reject('illegalTarget', `That card is not the one ${awaiting.label} lets you cast.`);
    const bound = { none: awaiting.none ?? [], filter: awaiting.filter ?? null, qualifier: awaiting.qualifier ?? null };
    if (!freeCastAdmits(state, deps, pick, bound)) {
      return reject('illegalTarget', `That card is not ${awaiting.filter?.what ?? 'a spell'} ${awaiting.label} lets you cast without paying its mana cost right now.`);
    }
    return beginGrantedCast(state, deps, intent.player, pick, awaiting.continuation, awaiting.madness !== undefined);
  }
  // D390 - a discard inside a player queue is RECORDED, not applied: every player's discard happens
  // at once when the last has chosen (CR 101.4). A lone discard prompt keeps today's path below.
  if (state.pendingAsks !== null && state.pendingAsks.verb === 'discard') {
    return advanceAsks(state, deps, intent.player, intent.cards);
  }

  // D377 - the DISCARD PROMPT's answer (D137). This is the path a spell that says "discard two
  // cards" takes, so it is the one most printed discard watchers will ever see.
  const moves = intent.cards.map((card) => ({
    card,
    from: { kind: 'hand' as const, player: intent.player },
    to: { kind: 'graveyard' as const, player: state.cards[card]?.owner ?? intent.player },
    reason: 'discard' as const,
  }));
  const events: EventBody[] = [
    { t: 'AwaitingSet', awaiting: null },
    { t: 'CardsMoved', moves },
    narrated(
      n`${who(state, intent.player)} ${vb(intent.player, 'discards', 'discard')} ${intent.cards.length} card${intent.cards.length === 1 ? '' : 's'}.`,
      intent.player,
    ),
  ];
  // D435 - the rummage's draw (`Discard a card. If you do, draw a card.`): the discard just happened, so the draw
  // follows in the same batch - off the library the discard never touched.
  if (awaiting.thenDraw !== undefined && awaiting.thenDraw > 0) events.push(...drawEvents(state, intent.player, awaiting.thenDraw));
  // D412 - a connive's discard: the counter for a nonland card, the marker (CR 701.50c), and the chain's
  // remainder, run against the state the answer left.
  if (awaiting.connive) {
    let scratch = state;
    for (const body of events) scratch = apply(scratch, { seq: scratch.eventCount, body, cause: { kind: 'system' } } as never);
    events.push(...conniveAfterDiscard(scratch, deps, intent.player, awaiting.connive.permanent, intent.cards, awaiting.label, awaiting.connive.remaining));
  }
  // D484 - the clauses after the discard (forwarded onto the chain's next connive when one was raised).
  return accept(events, resumeContinuation(state, deps, events, awaiting.continuation));
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
  deps: EngineDeps,
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
  const ordered: EventBody[] = [
    { t: 'AwaitingSet', awaiting: null },
    { t: 'CardsMoved', moves },
    { t: 'CardsRevealed', cards: [...shown], to: [] },
    narrated(
      n`${who(state, intent.player)} ${vb(intent.player, 'puts', 'put')} ${intent.cards.length} cards on the ${awaiting.destination} of ${their(intent.player)} library.`,
      intent.player,
    ),
  ];
  // D484 - the clauses after the look, once its leftovers are ordered.
  return accept(ordered, resumeContinuation(state, deps, ordered, awaiting.continuation));
}

/**
 * Scry or surveil, answered (D195). The FOURTH prompt over a hidden zone, so
 * the whole legality check lives here — the answer must be an EXACT partition
 * of the revealed run: every card once, nothing outside it, nothing missing.
 *
 * ⚠️ `toTop` is FIRST ENTRY FIRST (the card that ends up on top), and the
 * moves are applied in REVERSE for `answerOrderCards`'s reason: each
 * `placement: 'top'` puts its card at the end of the array, so the last one
 * applied lands topmost.
 *
 * ⚠️ **THE `thenDraw` RIDER IS EMITTED AGAINST A SCRATCH STATE.** "Scry 2,
 * then draw a card" must draw the card the player just placed on top —
 * `drawEvents` built against the PRE-answer state would take the top of the
 * unplaced run instead. The scry's own events are folded through the pure
 * reducer first, and the draw is computed from what the library then is;
 * both event groups go out in one accept, in that order, so the reducer
 * applies them exactly as the scratch predicted. (This also keeps every draw
 * rule — the D189 marker, the empty-library loss — in THE one place, D158.)
 */
function answerScry(
  state: GameState,
  intent: Extract<Intent, { t: 'AnswerScry' }>,
  deps: EngineDeps,
): HandleResult {
  const awaiting = state.priority.awaiting;
  if (awaiting?.kind !== 'scryChoice' || awaiting.player !== intent.player) {
    return reject('notAwaitingThat', 'You are not scrying.');
  }
  const lib = state.zones.library[intent.player] ?? [];
  const shown = lib.filter((id) => state.cards[id]?.revealedTo.includes(intent.player));
  const answered = [...intent.toTop, ...intent.toBottom];
  if (answered.length !== shown.length) {
    return reject('invalidAmount', `Place all ${shown.length} card${shown.length === 1 ? '' : 's'}.`);
  }
  const unique = new Set(answered);
  if (unique.size !== answered.length) {
    return reject('noSuchCard', 'You named the same card twice.');
  }
  for (const card of answered) {
    if (!shown.includes(card)) return reject('wrongZone', 'That card is not one you are looking at.');
  }

  const sendAway: CardMove[] = intent.toBottom.map((card) =>
    awaiting.toGraveyard
      ? {
          card,
          from: { kind: 'library' as const, player: intent.player },
          to: { kind: 'graveyard' as const, player: state.cards[card]?.owner ?? intent.player },
        }
      : {
          card,
          from: { kind: 'library' as const, player: intent.player },
          to: { kind: 'library' as const, player: intent.player },
          // ⚠️ Required — `addToZone` appends and the top is the END of the
          // array, so without it the declined card sits under the next draw.
          placement: 'bottom' as const,
        },
  );
  const keep: CardMove[] = [...intent.toTop].reverse().map((card) => ({
    card,
    from: { kind: 'library' as const, player: intent.player },
    to: { kind: 'library' as const, player: intent.player },
    placement: 'top' as const,
  }));

  const events: EventBody[] = [
    { t: 'AwaitingSet', awaiting: null },
    ...(sendAway.length + keep.length > 0 ? [{ t: 'CardsMoved' as const, moves: [...sendAway, ...keep] }] : []),
    // Clear the reveal, or the player keeps seeing these cards forever —
    // `view.peek` reads `revealedTo`.
    { t: 'CardsRevealed', cards: [...shown], to: [] },
    awaiting.explore
      ? narrated(n`${who(state, intent.player)} ${intent.toBottom.length > 0 ? vb(intent.player, 'puts', 'put') : vb(intent.player, 'keeps', 'keep')} the explored card ${intent.toBottom.length > 0 ? 'into the graveyard' : 'on top'}.`, intent.player)
      : narrated(
          n`${who(state, intent.player)} ${vb(intent.player, awaiting.toGraveyard ? 'surveils' : 'scries', awaiting.toGraveyard ? 'surveil' : 'scry')} ${shown.length}, keeping ${intent.toTop.length} on top.`,
          intent.player,
        ),
  ];

  // D409 - an explore's question: the permanent has explored once it is answered (CR 701.42c), and the
  // chain's next explore runs against the state the answer left, stopping behind its own question.
  if (awaiting.explore) {
    events.push({ t: 'Explored', permanent: awaiting.explore.permanent, controller: intent.player, card: shown[0] ?? null, land: false });
    if (awaiting.explore.remaining > 0) {
      let scratch = state;
      for (const body of events) scratch = apply(scratch, { seq: scratch.eventCount, body, cause: { kind: 'system' } } as never);
      events.push(...exploreChain(scratch, deps, intent.player, awaiting.explore.permanent, awaiting.label, awaiting.explore.remaining));
    }
  }
  // D527 - a clash's placement (CR 701.10): after yours, the opponent reveals and chooses; after theirs, the clash is
  // decided and its verdict rides the continuation (`If you win`). A clasher with no card asks nothing.
  if (awaiting.clash) {
    let scratch = state;
    for (const body of events) scratch = apply(scratch, { seq: scratch.eventCount, body, cause: { kind: 'system' } } as never);
    if (awaiting.clash.stage === 'you') events.push(...clashOpponentStep(scratch, deps, awaiting.clash, awaiting.label));
    else events.push(...clashFinish(scratch, awaiting.clash, awaiting.label));
    const decided = events.find((e) => e.t === 'Clashed');
    if (decided !== undefined && decided.t === 'Clashed') {
      const carried = awaiting.continuation === undefined ? undefined : { ...awaiting.continuation, clash: decided.won ? ('won' as const) : ('lost' as const) };
      return accept(events, resumeContinuation(state, deps, events, carried));
    }
  }
  if (awaiting.thenDraw > 0) {
    // Fold the scry through the pure reducer so the draw sees the reordered
    // library; the seq numbers on the scratch are irrelevant — only zones are
    // read back out.
    let scratch = state;
    for (const body of events) {
      scratch = apply(scratch, {
        seq: scratch.eventCount,
        body,
        cause: { kind: 'system' },
      } as never);
    }
    events.push(...drawEvents(scratch, intent.player, awaiting.thenDraw));
  }

  // D484 - the clauses after the scry (forwarded onto the chain's next explore when one was raised).
  return accept(events, resumeContinuation(state, deps, events, awaiting.continuation));
}

/**
 * D391 - proliferate (CR 701.27a). The answer names any number of permanents and players with a
 * counter; the host checks each against the board AS IT STANDS (nothing can happen between the
 * ask and the answer) - a permanent with no counter, a player with no poison, another player's
 * answer and a duplicate are refused by name. ONE `CountersChanged` batch carries one more
 * counter of each kind on every chosen permanent; each chosen player takes a poison counter, the
 * only player counter this engine tracks. The `Proliferated` marker goes first, so the fuzz
 * canary can count what was chosen - the replay hash cannot tell these counters from any other.
 */
function answerProliferate(
  state: GameState,
  intent: Extract<Intent, { t: 'AnswerProliferate' }>,
  deps: EngineDeps,
): HandleResult {
  const awaiting = state.priority.awaiting;
  if (awaiting?.kind !== 'proliferateChoice' || awaiting.player !== intent.player) {
    return reject('notAwaitingThat', 'You are not proliferating.');
  }
  if (new Set(intent.permanents).size !== intent.permanents.length || new Set(intent.players).size !== intent.players.length) {
    return reject('noSuchCard', 'You named the same thing twice.');
  }
  const cands = proliferateCandidates(state);
  for (const card of intent.permanents) {
    if (!cands.permanents.includes(card)) return reject('illegalTarget', 'That permanent has no counter on it.');
  }
  for (const p of intent.players) {
    if (!cands.players.includes(p)) return reject('illegalTarget', 'That player has no counters.');
  }
  const changes = intent.permanents.flatMap((card) =>
    Object.entries(state.cards[card]?.counters ?? {})
      .filter(([, v]) => v > 0)
      .map(([kind]) => ({ card, kind, delta: 1 })),
  );
  const chosen = intent.permanents.length + intent.players.length;
  const summary =
    chosen === 0
      ? ' nothing'
      : `: ${intent.permanents.length} permanent${intent.permanents.length === 1 ? '' : 's'} and ${intent.players.length} player${intent.players.length === 1 ? '' : 's'}`;
  const events: EventBody[] = [
    { t: 'AwaitingSet', awaiting: null },
    { t: 'Proliferated', player: intent.player, permanents: [...intent.permanents], players: [...intent.players] },
    ...(changes.length > 0 ? [{ t: 'CountersChanged' as const, changes }] : []),
    ...intent.players.map((p) => ({ t: 'PoisonChanged' as const, player: p, delta: 1, to: (state.players[p]?.poison ?? 0) + 1 })),
    narrated(n`${who(state, intent.player)} ${vb(intent.player, 'proliferates', 'proliferate')}${summary}.`, intent.player),
  ];
  // D484 - the clauses after the proliferate.
  return accept(events, resumeContinuation(state, deps, events, awaiting.continuation));
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
