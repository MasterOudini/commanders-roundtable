// What a client asks for. The host turns an `Intent` into `Event[]` or a
// `Reject`; nothing else can change the game.
//
// ⚠️ Blocker declaration is ONE intent carrying the whole declaration, not one
// intent per block. That is forced by `menace`: "blocked by 0 or ≥2 creatures"
// is a property of the complete declaration, and a per-pair API physically
// cannot express "these two at once" — it would have to accept the first
// illegal single block and then retroactively un-accept it. Attacker
// declaration is atomic for the same reason.

import type { InstanceId, PlayerId } from './ids';
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
  | { readonly t: 'PlayLand'; readonly player: PlayerId; readonly card: InstanceId }
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
      readonly xValue?: number;
      readonly targets?: readonly TargetChoice[];
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
      readonly plan?: PaymentPlan;
    }
  | { readonly t: 'ChooseTargets'; readonly player: PlayerId; readonly targets: readonly TargetChoice[] }
  | { readonly t: 'ChooseX'; readonly player: PlayerId; readonly x: number }
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
  | { readonly t: 'OrderBlockers'; readonly player: PlayerId; readonly attacker: InstanceId; readonly order: readonly InstanceId[] }
  | { readonly t: 'OrderAttackers'; readonly player: PlayerId; readonly blocker: InstanceId; readonly order: readonly InstanceId[] }

  // prompts
  | { readonly t: 'ChooseLegendKeep'; readonly player: PlayerId; readonly keep: InstanceId }
  | { readonly t: 'CommanderZoneChoice'; readonly player: PlayerId; readonly toCommandZone: boolean; readonly always: boolean }
  | { readonly t: 'OrderTriggers'; readonly player: PlayerId; readonly order: readonly string[] }

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
  | 'invalidPaymentPlan'
  | 'landDropUsed'
  | 'notALand'
  | 'noPendingCast'
  | 'wrongCastStage'
  | 'illegalTarget'
  | 'illegalAttacker'
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
