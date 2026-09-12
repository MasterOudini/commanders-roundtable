// What a client asks for. The host turns an `Intent` into `Event[]` or a
// `Reject`; nothing else can change the game.
//
// ⚠️ Blocker declaration is ONE intent carrying the whole declaration, not one
// intent per block. That is forced by `menace`: "blocked by 0 or ≥2 creatures"
// is a property of the complete declaration, and a per-pair API physically
// cannot express "these two at once" — it would have to accept the first
// illegal single block and then retroactively un-accept it. Attacker
// declaration is atomic for the same reason.

import type { ColorLetter } from '../../data/cardTypes';
import type { AbilityRef, InstanceId, PlayerId, StackId } from './ids';
import type { DefenderRef, StopPolicy, TargetChoice } from './state';
import type { PaymentPlan } from './mana';

export type Intent =
  // setup / mulligan
  | { readonly t: 'StartGame' }
  | { readonly t: 'MulliganDecision'; readonly player: PlayerId; readonly keep: boolean }
  | { readonly t: 'MulliganBottom'; readonly player: PlayerId; readonly cards: readonly InstanceId[] }

  // priority
  | { readonly t: 'PassPriority'; readonly player: PlayerId }
  | { readonly t: 'HoldPriority'; readonly player: PlayerId; readonly hold: boolean }
  | { readonly t: 'SetStops'; readonly player: PlayerId; readonly stops: StopPolicy }
  /** Anyone may pass for a disconnected player. Every such pass is logged (Q6). */
  | { readonly t: 'PassForPlayer'; readonly player: PlayerId; readonly target: PlayerId }

  // playing cards
  /**
   * ⚠️ `faceIndex` is the MODAL DFC's back face — CR 712. Omit it for every
   * ordinary card; `Malakir Rebirth // Malakir Mire` needs `1` to play the land
   * half. Until D155 neither this intent nor `CastSpell` could say which face,
   * while `legalActions` had been OFFERING both since M3 — so 98 Commander-legal
   * cards had a back face that was listed, clickable and unplayable.
   */
  | { readonly t: 'PlayLand'; readonly player: PlayerId; readonly card: InstanceId; readonly faceIndex?: number }
  /**
   * ⚠️ `targets: undefined` and `targets: []` MEAN DIFFERENT THINGS, and
   * `exactOptionalPropertyTypes` makes the difference exact. Undefined is "not
   * supplied — stop and ask me"; `[]` is "supplied, none", which is both Wrath of
   * God and a player deliberately declining an `up to one`. `xValue?` has always
   * worked this way, so a one-shot caller keeps working unchanged.
   */
  | {
      readonly t: 'CastSpell';
      readonly player: PlayerId;
      readonly card: InstanceId;
      /** The modal DFC / split / adventure face being cast. See `PlayLand`. */
      readonly faceIndex?: number;
      readonly xValue?: number;
      readonly targets?: readonly TargetChoice[];
      readonly plan?: PaymentPlan;
      /** D343 - the modes of a modal spell, named inline (a driver, a test); absent, the host asks. */
      readonly modes?: readonly number[];
      /** D309 - cast face down as a 2/2 for {3} (morph, CR 702.37a). */
      readonly faceDown?: boolean;
      /**
       * D403 - KICKER (CR 702.33): how many times the kicker is paid - 1 for `Kicker {M}`, any
       * number for `Multikicker {M}`; absent or 0 casts the spell unkicked. The host adds the
       * cost to the payment and the stack object remembers the count.
       */
      readonly kicked?: number;
      /**
       * D405 - CONVOKE (CR 702.51), IMPROVISE (CR 702.126), DELVE (CR 702.66): the creatures the
       * caster taps, the artifacts the caster taps, the cards the caster exiles from their graveyard,
       * each paying one symbol of the cost (a creature a coloured one of its colour, else generic;
       * the rest generic). A choice that would pay for nothing is refused by name. Absent or
       * empty: the plain cast.
       */
      readonly convoke?: readonly InstanceId[];
      readonly improvise?: readonly InstanceId[];
      readonly delve?: readonly InstanceId[];
    }
  /**
   * D309 - THE MORPH SEAM: turning a face-down permanent you control face up
   * for its morph cost - a special action any time you have priority (CR
   * 702.37c), no stack, nothing to respond to.
   */
  | {
      readonly t: 'TurnFaceUp';
      readonly player: PlayerId;
      readonly card: InstanceId;
      readonly plan?: PaymentPlan;
    }
  /**
   * Activating a non-mana ability of a permanent you control. Mana abilities go
   * through `TapForMana` instead and never use the stack (CR 605).
   *
   * ⚠️ The source card DOES NOT MOVE. Unlike a cast there is no `CardsMoved` on
   * the way in and none to compensate on cancel — get that wrong and you either
   * delete a permanent or duplicate it.
   */
  | {
      readonly t: 'ActivateAbility';
      readonly player: PlayerId;
      readonly card: InstanceId;
      readonly abilityIndex: number;
      readonly targets?: readonly TargetChoice[];
      /** D343 - the modes of a modal ability (its def declares them), named inline; absent, the host asks. */
      readonly modes?: readonly number[];
      readonly plan?: PaymentPlan;
      /**
       * Which permanent pays a "Sacrifice a <predicate>" cost (D168).
       * Required when the ability carries one; the host re-validates it
       * against `sacrificeCandidatesFor` — a client's word is not a rule.
       */
      readonly sacrifice?: readonly InstanceId[];
      /**
       * Which cards pay a "Discard N cards" cost (D286) — exactly `count`,
       * re-validated by the host against `discardCandidatesFor`.
       */
      readonly discard?: readonly InstanceId[];
      /**
       * Which permanents pay a "Tap N untapped <predicate> you control" cost
       * (D286) — exactly `count`, re-validated against `tapCandidatesFor`.
       */
      readonly tap?: readonly InstanceId[];
      /**
       * D329 - which graveyard cards pay an "Exile N ... from your graveyard"
       * cost - exactly `count`, re-validated against `exileFromGraveyardCandidatesFor`.
       */
      readonly exileFromGraveyard?: readonly InstanceId[];
      /**
       * D352 - which permanents pay a "Return N <predicate> you control to its
       * owner's hand" cost - exactly `count`, re-validated against
       * `returnCandidatesFor`.
       */
      readonly returnToHand?: readonly InstanceId[];
      /**
       * D363 - which permanents pay a "Remove N <kind> counters from a <predicate>
       * you control" cost - exactly `count` picks, re-validated against
       * `removeCounterCandidatesFor`.
       *
       * ⚠️ A MULTISET, not a set: "remove two +1/+1 counters from among creatures
       * you control" may take both from ONE creature carrying two, so a permanent
       * named k times must carry k counters. Every other chooser forbids a repeat;
       * this one is about counters rather than about permanents.
       */
      readonly removeCounter?: readonly InstanceId[];
      /**
       * D367 - activating an ability ANOTHER permanent's static GRANTED this one
       * (`<providerOracleId>#g<n>`, carried on the legal action that offered it).
       * Present, `abilityIndex` is ignored: the ability is read off the
       * recipient's DERIVED object, and refused if the grant is no longer live.
       */
      readonly grantRef?: AbilityRef;
    }
  | { readonly t: 'ChooseTargets'; readonly player: PlayerId; readonly targets: readonly TargetChoice[] }
  | { readonly t: 'ChooseX'; readonly player: PlayerId; readonly x: number }
  /** D343 - the answer to `chooseModes`: the chosen mode indices, each at most once. */
  | { readonly t: 'ChooseModes'; readonly player: PlayerId; readonly modes: readonly number[] }
  | { readonly t: 'PayCast'; readonly player: PlayerId; readonly plan: PaymentPlan }
  | { readonly t: 'CancelPendingCast'; readonly player: PlayerId }
  | { readonly t: 'TapForMana'; readonly player: PlayerId; readonly card: InstanceId; readonly abilityIndex: number; readonly outputChoice: number }

  // combat
  | {
      readonly t: 'DeclareAttackers';
      readonly player: PlayerId;
      readonly attackers: readonly { readonly card: InstanceId; readonly defender: DefenderRef }[];
    }
  | {
      readonly t: 'DeclareBlockers';
      readonly player: PlayerId;
      readonly blocks: readonly { readonly blocker: InstanceId; readonly attacker: InstanceId }[];
    }
  /**
   * D357 - the cards found. EMPTY IS LEGAL (CR 701.19b, failing to find), and the handler
   * checks each against the predicate and the searcher's own library rather than trusting it.
   */
  /**
   * D359 - `declined` is REQUIRED, and that is the whole point of it: an optional search that
   * defaulted to false somewhere would look at the library on the player's behalf. Making the
   * field mandatory turns every construction site into a compile error until it says which
   * answer it means. `declined` and a non-empty `cards` are contradictory and rejected.
   */
  | { readonly t: 'AnswerSearchLibrary'; readonly player: PlayerId; readonly cards: readonly InstanceId[]; readonly declined: boolean }
  | { readonly t: 'OrderBlockers'; readonly player: PlayerId; readonly attacker: InstanceId; readonly order: readonly InstanceId[] }
  | { readonly t: 'OrderAttackers'; readonly player: PlayerId; readonly blocker: InstanceId; readonly order: readonly InstanceId[] }

  // prompts
  | { readonly t: 'ChooseLegendKeep'; readonly player: PlayerId; readonly keep: InstanceId }
  | { readonly t: 'CommanderZoneChoice'; readonly player: PlayerId; readonly toCommandZone: boolean; readonly always: boolean }
  | { readonly t: 'OrderTriggers'; readonly player: PlayerId; readonly order: readonly string[] }
  /**
   * The answer to a "may" trigger (CR 603.1), named by the stack object it is
   * about so a stale answer cannot resolve the wrong ability.
   *
   * ⚠️ `accept: false` is not a no-op — it is what makes the ability resolve
   * having done nothing, which is the outcome the card offers and the one the
   * engine has never been able to produce.
   */
  | { readonly t: 'AnswerOptionalTrigger'; readonly player: PlayerId; readonly stackId: StackId; readonly accept: boolean }
  /**
   * D369 - the answer to a payment prompt. `plan` is the client's own solve (D53: the same
   * solver the host validates with); omitted, the host suggests one - which is what every
   * driver but a person does.
   */
  | { readonly t: 'AnswerPayMana'; readonly player: PlayerId; readonly pay: boolean; readonly plan?: PaymentPlan }
  /**
   * CR 614.12. `pay: true` pays the life and the permanent stays untapped;
   * `false` leaves it tapped. Names the SOURCE rather than a stack id, because a
   * replacement effect never uses the stack. See D136.
   */
  /** CR 614.12 — the colour named as a permanent enters. See D147. */
  /** CR 616.1 — which applicable replacement effect applies next. See D148. */
  | { readonly t: 'AnswerChooseReplacement'; readonly player: PlayerId; readonly key: string }
  | { readonly t: 'AnswerChooseColor'; readonly player: PlayerId; readonly color: ColorLetter }
  | { readonly t: 'AnswerEntersChoice'; readonly player: PlayerId; readonly source: InstanceId; readonly pay: boolean }
  /**
   * CR 701.8a. The cards the player picked out of their own hand, or out of the
   * top of their library (D141).
   *
   * ⚠️ The prompt carries no candidates (see `Awaiting.chooseFromZone`), so this
   * is the first intent whose legality the handler must check ENTIRELY from the
   * state: every id in the player's own hand, no duplicates, exactly `count` of
   * them. See D137.
   */
  | { readonly t: 'AnswerChooseFromZone'; readonly player: PlayerId; readonly cards: readonly InstanceId[] }
  /**
   * The sequence the player chose for "…in any order", FIRST ENTRY FIRST — the
   * card that ends up nearest the named end of the library. See D142.
   *
   * ⚠️ Every id must be one the prompt is about and each exactly once, checked
   * against the state for `AnswerChooseFromZone`'s reason: the prompt vouches
   * for nothing because it carries nothing.
   */
  | { readonly t: 'AnswerOrderCards'; readonly player: PlayerId; readonly cards: readonly InstanceId[] }
  /**
   * The scry/surveil answer (D195): `toTop` FIRST ENTRY FIRST — the card that
   * ends up on top — and `toBottom` is the rest (the graveyard, for a
   * surveil). Together they must be an EXACT partition of the revealed run,
   * checked against the state for `AnswerChooseFromZone`'s reason: the prompt
   * vouches for nothing because it carries nothing.
   */
  | {
      readonly t: 'AnswerScry';
      readonly player: PlayerId;
      readonly toTop: readonly InstanceId[];
      readonly toBottom: readonly InstanceId[];
    }
  /** D391 - proliferate: the permanents and players chosen (any number; none is a legal answer). */
  | {
      readonly t: 'AnswerProliferate';
      readonly player: PlayerId;
      readonly permanents: readonly InstanceId[];
      readonly players: readonly PlayerId[];
    }

  // Tier 3 — manual tools. NOT enforced; every one is marked in the log.
  | { readonly t: 'ManualMoveCard'; readonly player: PlayerId; readonly card: InstanceId; readonly to: { readonly kind: 'library' | 'hand' | 'battlefield' | 'graveyard' | 'exile' | 'command'; readonly player: PlayerId }; readonly placement?: 'top' | 'bottom'; readonly faceDown?: boolean }
  | { readonly t: 'ManualCreateToken'; readonly player: PlayerId; readonly printingId: string; readonly count: number }
  | { readonly t: 'ManualSetCounter'; readonly player: PlayerId; readonly card: InstanceId; readonly kind: string; readonly delta: number }
  | { readonly t: 'ManualSetLife'; readonly player: PlayerId; readonly target: PlayerId; readonly delta: number }
  | { readonly t: 'ManualSetPoison'; readonly player: PlayerId; readonly target: PlayerId; readonly delta: number }
  | { readonly t: 'ManualAddMana'; readonly player: PlayerId; readonly target: PlayerId; readonly symbol: 'W' | 'U' | 'B' | 'R' | 'G' | 'C'; readonly amount: number }
  | { readonly t: 'ManualEmptyPool'; readonly player: PlayerId; readonly target: PlayerId }
  | { readonly t: 'ManualSetTapped'; readonly player: PlayerId; readonly cards: readonly InstanceId[]; readonly tapped: boolean }
  | { readonly t: 'ManualSetFaceDown'; readonly player: PlayerId; readonly card: InstanceId; readonly faceDown: boolean }
  | { readonly t: 'ManualFlipFace'; readonly player: PlayerId; readonly card: InstanceId }
  | { readonly t: 'ManualSetPt'; readonly player: PlayerId; readonly card: InstanceId; readonly power: number | null; readonly toughness: number | null }
  | { readonly t: 'ManualAttach'; readonly player: PlayerId; readonly card: InstanceId; readonly to: InstanceId | null }
  | { readonly t: 'ManualSetController'; readonly player: PlayerId; readonly card: InstanceId; readonly controller: PlayerId }
  | { readonly t: 'ManualReveal'; readonly player: PlayerId; readonly cards: readonly InstanceId[]; readonly toAll: boolean }
  | { readonly t: 'ManualPeekLibrary'; readonly player: PlayerId; readonly count: number }
  /**
   * Stop looking: clear whatever I am currently peeking at off the top of my own
   * library, leaving those cards where they are.
   *
   * ⚠️ Needed because a peek has no natural end. Cards that get MOVED lose their
   * reveal on the way (the reducer clears it, or the new zone would leak), so a
   * scry only ever leaves the ones staying on top still revealed — and without
   * this they would stay revealed for the rest of the game.
   */
  | { readonly t: 'ManualStopPeeking'; readonly player: PlayerId }
  /**
   * Move the top N of a library somewhere, WITHOUT looking first.
   *
   * ⚠️ It exists because a client cannot name a library card: projection strips
   * the order and the ids, so "mill three" is not expressible as three
   * `ManualMoveCard`s. Doing it as peek-then-move would work and would be wrong:
   * it puts "You look at the top 3 cards" in the log before every mill, which is
   * a different action from the one the player took.
   */
  | {
      readonly t: 'ManualMoveTopOfLibrary';
      readonly player: PlayerId;
      readonly target: PlayerId;
      readonly count: number;
      readonly to: 'graveyard' | 'exile';
    }
  /**
   * Move a WHOLE open zone somewhere: a graveyard shuffled into its library, or
   * exiled entire.
   *
   * ⚠️ One intent rather than N `ManualMoveCard`s, and the reason is the LOG:
   * thirty cards leaving a graveyard is one thing a player did, and thirty lines
   * saying so buries the game in it. It is also the only way the shuffle can be
   * part of the same action — `order` has to be a permutation of the library
   * AFTER the cards arrive.
   */
  | {
      readonly t: 'ManualMoveZone';
      readonly player: PlayerId;
      readonly target: PlayerId;
      readonly from: 'graveyard' | 'exile';
      readonly to: 'library' | 'exile';
      readonly shuffle: boolean;
    }
  | { readonly t: 'ManualDraw'; readonly player: PlayerId; readonly target: PlayerId; readonly count: number }
  | { readonly t: 'ManualShuffle'; readonly player: PlayerId; readonly target: PlayerId }
  /**
   * Apply the part of a resolved spell the app DID understand, because the
   * player asked it to.
   *
   * ⚠️ A MANUAL intent, and that is the whole point. The card was `assisted` —
   * some of its text was understood and some was not — so the engine refuses to
   * act on it by itself. This is the player saying "yes, do that bit", and it is
   * logged with the wrench like every other Tier-3 action, because the rest of
   * the card is still theirs to apply.
   */
  | {
      readonly t: 'ManualApplyEffect';
      readonly player: PlayerId;
      /** The card that resolved. It is in a graveyard or on the battlefield by now. */
      readonly card: InstanceId;
      readonly targets: readonly TargetChoice[];
    }
  | { readonly t: 'ManualSetCommander'; readonly player: PlayerId; readonly card: InstanceId; readonly isCommander: boolean }
  | { readonly t: 'RollDice'; readonly player: PlayerId; readonly sides: number }
  | { readonly t: 'FlipCoin'; readonly player: PlayerId }
  | { readonly t: 'Concede'; readonly player: PlayerId }

  // rewind (D9 — in scope for v1)
  | { readonly t: 'ProposeRewind'; readonly player: PlayerId; readonly toEventCount: number }
  | { readonly t: 'VoteRewind'; readonly player: PlayerId; readonly agree: boolean }
  | { readonly t: 'CancelRewind'; readonly player: PlayerId };

export type IntentKind = Intent['t'];

export type RejectReason =
  | 'notYourPriority'
  | 'notYourTurn'
  | 'wrongStep'
  | 'gameNotStarted'
  | 'gameOver'
  | 'playerHasLost'
  | 'noSuchCard'
  | 'noSuchPlayer'
  | 'wrongZone'
  | 'notCastable'
  | 'timingRestriction'
  | 'cannotAfford'
  | 'stalePaymentPlan'
  | 'needsSacrifice'
  | 'illegalSacrifice'
  | 'needsDiscard'
  | 'illegalDiscard'
  | 'needsTap'
  | 'illegalTap'
  | 'needsReturn'
  /** D363 - the ability removes counters from permanents the player must name. */
  | 'needsRemoveCounter'
  | 'illegalReturn'
  /** D363 - the picks for a "Remove N counters from a <predicate> you control" cost. */
  | 'illegalRemoveCounter'
  | 'needsExileFromGraveyard'
  | 'illegalExileFromGraveyard'
  | 'invalidPaymentPlan'
  | 'landDropUsed'
  | 'notALand'
  | 'noPendingCast'
  /** Nothing is waiting for the answer that was sent. */
  | 'noPendingChoice'
  | 'wrongCastStage'
  | 'illegalTarget'
  | 'illegalMode'
  | 'illegalAttacker'
  /** D335 - CR 508.1d: a creature that attacks each combat if able was left out. */
  | 'attackRequired'
  | 'illegalBlock'
  | 'menaceRequiresTwo'
  | 'notAwaitingThat'
  | 'alreadySubmitted'
  | 'notAManaAbility'
  | 'alreadyTapped'
  | 'notUntapped'
  | 'invalidOrder'
  | 'invalidAmount'
  | 'noSuchToken'
  | 'rewindOutOfRange'
  | 'noRewindPending'
  | 'playerConnected'
  | 'unknownIntent';

export interface Reject {
  readonly ok: false;
  readonly reason: RejectReason;
  /** Written from the user's side, and it says what to do next. */
  readonly message: string;
}

export interface Accept {
  readonly ok: true;
  readonly events: readonly import('./events').EventBody[];
  /** Set only when the handler consumed randomness (shuffle, dice, coin). */
  readonly rng?: import('../rng').RngState;
  /**
   * These events have ALREADY been through the replacement funnel — do not run
   * it again.
   *
   * ⚠️ **THE ONE PRODUCER IS `AnswerChooseReplacement`** (CR 616, D148), and it
   * needs this because it is the only handler that resumes a suspended fold: its
   * events are the REST of a batch that was already funnelled, and re-running the
   * built-ins over them would apply them twice — a planeswalker entering would
   * get its loyalty a second time, and the card-script effects would be offered
   * a second turn in violation of CR 614.5.
   *
   * ⚠️ It is an OPT-IN on the one path that needs it rather than a check inside
   * the funnel, because "have I seen this event before" is not a question an
   * event can answer about itself.
   */
  readonly funnelled?: boolean;
}

export type HandleResult = Accept | Reject;

export function reject(reason: RejectReason, message: string): Reject {
  return { ok: false, reason, message };
}

export function accept(
  events: readonly import('./events').EventBody[],
  rng?: import('../rng').RngState,
): Accept {
  return rng === undefined ? { ok: true, events } : { ok: true, events, rng };
}
