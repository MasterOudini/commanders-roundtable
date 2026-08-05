// The event union. Everything that has ever changed the game is one of these.
//
// ⚠️ THE INVARIANT THE WHOLE APP RESTS ON: no code path mutates state without
// emitting an event. Not the priority loop, not state-based actions, and not
// any of the Tier-3 manual tools. That single property gives replay, reconnect,
// group rewind, the trigger bus and the animation cue stream for free — and
// every one of those breaks silently the moment something writes state directly.
//
// ⚠️ `apply(state, event)` must be a pure function of (state, event) ALONE —
// no oracle, no clock, no randomness. That is why events look verbose: an event
// carries the outcome, not the instruction. `CardsMoved` names the destination
// index; `Narrated` carries rendered text rather than a template; a shuffle
// carries the resulting order. Anything the reducer would have to *look up* is
// a chance for the replay and the live game to disagree.

import type { ColorLetter } from '../../data/cardTypes';
import type { RngState } from '../rng';
import type {
  AbilityRef,
  InstanceId,
  OracleId,
  PlayerId,
  PrintingId,
  StackId,
  ZoneRef,
} from './ids';
import type { ManaPool } from './mana';
import type { NarrationPart } from './narration';
import type {
  Awaiting,
  DefenderRef,
  GameOptions,
  LossReason,
  PendingCast,
  PendingReplacement,
  PendingTrigger,
  Phase,
  StackObject,
  Step,
  StopPolicy,
  TargetChoice,
} from './state';

/** Where in a destination zone a card lands. Libraries need this; piles do not. */
export type ZonePlacement = 'top' | 'bottom';

export interface CardMove {
  readonly card: InstanceId;
  readonly from: ZoneRef;
  readonly to: ZoneRef;
  readonly placement?: ZonePlacement;
  readonly faceDown?: boolean;
  /**
   * The face this card is moving AS — CR 712, a modal DFC's back face. Omit for
   * every ordinary card.
   *
   * ⚠️ **IT RIDES ON THE MOVE AND NOT ON A SEPARATE EVENT, AND THAT IS FORCED
   * BY THE FUNNEL** (D155). `runReplacementFunnel` reads the state BEFORE the
   * batch is applied, so an earlier `FaceIndexSet` in the same batch would not
   * be visible to it — "enters tapped" and "as this enters, pay 3 life" would
   * be decided from the front face. And a LATER one is too late for the same
   * question. The move is the event that says "this enters as face N", so the
   * face belongs on it — exactly as `faceDown` already does.
   */
  readonly faceIndex?: number;
}

export interface ResolvedDamage {
  readonly source: InstanceId;
  readonly target: { readonly kind: 'card'; readonly id: InstanceId } | { readonly kind: 'player'; readonly id: PlayerId };
  readonly amount: number;
  readonly deathtouch: boolean;
  readonly lifelinkTo: PlayerId | null;
  readonly isCommanderDamage: boolean;
  /** The portion assigned past the blockers, for the log. */
  readonly viaTrample: number;
  /**
   * How this damage is actually applied. CR 702.90 (infect) and 702.79 (wither).
   *
   * ⚠️ A REPLACEMENT, not an addition — the damage is still "dealt", it simply
   * results in counters rather than in life loss or damage marks. That
   * distinction is load-bearing for lifelink: CR 702.90b, a creature with infect
   * AND lifelink still gains its controller life, because life gain keys off the
   * damage being dealt and not off how it was applied. Modelling infect as
   * "deal 0 damage, then add counters" would silently break that.
   *
   * - `normal`   — life loss for a player, a damage mark on a creature
   * - `poison`   — infect hitting a PLAYER: poison counters instead of life loss
   * - `wither`   — infect or wither hitting a CREATURE: −1/−1 counters instead
   *                of a damage mark
   */
  readonly applyAs: 'normal' | 'poison' | 'wither';
  /**
   * `Toxic N` — poison counters added ON TOP of normal combat damage to a
   * player. CR 702.180a. Unlike infect this is additive, not a replacement, so
   * it rides alongside `applyAs: 'normal'`.
   */
  readonly toxic: number;
}

export type SbaAction =
  | { readonly t: 'playerLoses'; readonly player: PlayerId; readonly reason: LossReason }
  | { readonly t: 'zeroToughness'; readonly card: InstanceId }
  | { readonly t: 'lethalDamage'; readonly card: InstanceId }
  | { readonly t: 'zeroLoyalty'; readonly card: InstanceId }
  | { readonly t: 'zeroDefense'; readonly card: InstanceId }
  | { readonly t: 'auraFalls'; readonly card: InstanceId }
  | { readonly t: 'equipmentUnattaches'; readonly card: InstanceId }
  | { readonly t: 'legendRule'; readonly player: PlayerId; readonly name: string; readonly candidates: readonly InstanceId[] }
  /**
   * CR 704.5m. ⚠️ Carries no `candidates` and raises no prompt, unlike
   * `legendRule` above: the newest world permanent survives and the rest go,
   * with nothing for anyone to decide.
   */
  | { readonly t: 'worldRule'; readonly card: InstanceId }
  | { readonly t: 'tokenCeasesToExist'; readonly card: InstanceId }
  | { readonly t: 'counterAnnihilation'; readonly card: InstanceId; readonly amount: number };

export type EventBody =
  // ── game lifecycle ───────────────────────────────────────────────────────
  | {
      readonly t: 'GameCreated';
      readonly gameId: string;
      readonly options: GameOptions;
      readonly seating: readonly PlayerId[];
      readonly players: readonly { readonly id: PlayerId; readonly name: string; readonly seat: number }[];
      readonly seed: string;
    }
  | {
      readonly t: 'DeckLoaded';
      readonly player: PlayerId;
      readonly cards: readonly {
        readonly id: InstanceId;
        readonly oracleId: OracleId;
        readonly printingId: PrintingId;
      }[];
      readonly commanders: readonly {
        readonly id: InstanceId;
        readonly oracleId: OracleId;
        readonly printingId: PrintingId;
      }[];
      readonly identity: readonly ColorLetter[];
    }
  /** ⚠️ `order` is stripped from narration for EVERYONE, including the owner. */
  | { readonly t: 'LibraryShuffled'; readonly player: PlayerId; readonly order: readonly InstanceId[] }
  | { readonly t: 'GameStarted'; readonly startingPlayer: PlayerId }
  | { readonly t: 'GamePhaseChanged'; readonly phase: 'lobby' | 'mulligan' | 'playing' | 'finished' }
  | { readonly t: 'GameEnded'; readonly winners: readonly PlayerId[] }

  // ── mulligan ─────────────────────────────────────────────────────────────
  | { readonly t: 'MulliganTaken'; readonly player: PlayerId; readonly taken: number }
  | { readonly t: 'MulliganKept'; readonly player: PlayerId; readonly toBottom: number }
  | { readonly t: 'MulliganBottomed'; readonly player: PlayerId; readonly cards: readonly InstanceId[] }

  // ── zones and card state ─────────────────────────────────────────────────
  | { readonly t: 'CardsMoved'; readonly moves: readonly CardMove[] }
  | {
      readonly t: 'TokenCreated';
      readonly card: InstanceId;
      readonly oracleId: OracleId;
      readonly printingId: PrintingId;
      readonly controller: PlayerId;
      readonly owner: PlayerId;
      readonly turnNumber: number;
    }
  /**
   * A token outside the battlefield ceases to exist (CR 704.5d).
   *
   * ⚠️ A REMOVAL, not a move. Modelling it as `CardsMoved` to exile made the SBA
   * see the token in exile on the next pass and move it to exile again, forever
   * — `pump` hit its 10 000-iteration cap on the very first token that died.
   * Ceasing to exist is genuinely different from changing zones, and the event
   * union has to say so.
   */
  | { readonly t: 'TokensCeased'; readonly cards: readonly InstanceId[] }
  | { readonly t: 'CardsRevealed'; readonly cards: readonly InstanceId[]; readonly to: readonly PlayerId[] }
  | { readonly t: 'RevealCleared'; readonly cards: readonly InstanceId[] }
  | { readonly t: 'PermanentsTapped'; readonly cards: readonly InstanceId[] }
  | { readonly t: 'PermanentsUntapped'; readonly cards: readonly InstanceId[] }
  | {
      readonly t: 'CountersChanged';
      readonly changes: readonly { readonly card: InstanceId; readonly kind: string; readonly delta: number }[];
    }
  | { readonly t: 'DamageCleared'; readonly cards: readonly InstanceId[] }
  | { readonly t: 'AttachmentChanged'; readonly card: InstanceId; readonly to: InstanceId | null }
  | { readonly t: 'FaceDownSet'; readonly card: InstanceId; readonly faceDown: boolean }
  | { readonly t: 'FaceIndexSet'; readonly card: InstanceId; readonly faceIndex: number }
  | { readonly t: 'ControlChanged'; readonly card: InstanceId; readonly controller: PlayerId }
  | {
      readonly t: 'PtOverrideSet';
      readonly card: InstanceId;
      readonly override: { readonly power: number; readonly toughness: number } | null;
    }
  | { readonly t: 'TypeOverrideSet'; readonly card: InstanceId; readonly typeLine: string | null }
  | { readonly t: 'CommanderFlagSet'; readonly card: InstanceId; readonly isCommander: boolean }

  // ── players ──────────────────────────────────────────────────────────────
  | { readonly t: 'LifeChanged'; readonly player: PlayerId; readonly delta: number; readonly to: number }
  | { readonly t: 'PoisonChanged'; readonly player: PlayerId; readonly delta: number; readonly to: number }
  | { readonly t: 'ManaAdded'; readonly player: PlayerId; readonly mana: ManaPool; readonly source: InstanceId | null }
  | { readonly t: 'ManaSpent'; readonly player: PlayerId; readonly mana: ManaPool }
  /** `lost` is what the pool held, so the UI can say "you lost {R}{R}". */
  | { readonly t: 'ManaPoolEmptied'; readonly player: PlayerId; readonly lost: ManaPool }
  | {
      readonly t: 'CommanderDamageDealt';
      readonly player: PlayerId;
      readonly from: InstanceId;
      readonly amount: number;
      readonly total: number;
    }
  | { readonly t: 'PlayerLost'; readonly player: PlayerId; readonly reason: LossReason }
  /**
   * ⚠️ A separate event because the loss is NOT immediate: CR 704.5b makes the
   * player lose on the next state-based-action check, so a replacement effect
   * or a Tier-3 tool has a window to save them. A `CardsMoved` with fewer moves
   * than requested cannot express that, and the reducer must not infer it.
   */
  | { readonly t: 'DrewFromEmptyLibrary'; readonly player: PlayerId }
  | { readonly t: 'LandPlayed'; readonly player: PlayerId; readonly card: InstanceId; readonly playedThisTurn: number }
  | { readonly t: 'StopsChanged'; readonly player: PlayerId; readonly stops: StopPolicy }
  | { readonly t: 'PresenceChanged'; readonly player: PlayerId; readonly connected: boolean }
  | { readonly t: 'CommanderZoneAlwaysSet'; readonly player: PlayerId; readonly value: boolean | null }

  // ── turn / priority ──────────────────────────────────────────────────────
  | { readonly t: 'TurnBegan'; readonly turnNumber: number; readonly activePlayer: PlayerId }
  | { readonly t: 'StepBegan'; readonly phase: Phase; readonly step: Step }
  | { readonly t: 'StepEnded'; readonly phase: Phase; readonly step: Step }
  | { readonly t: 'TurnBasedActionsDone' }
  | { readonly t: 'CleanupRepeatSet'; readonly value: boolean }
  | { readonly t: 'PriorityGranted'; readonly player: PlayerId; readonly stackSize: number }
  | { readonly t: 'PriorityPassed'; readonly player: PlayerId; readonly auto: boolean; readonly forced: boolean }
  | { readonly t: 'PriorityReset' }
  | { readonly t: 'HoldPrioritySet'; readonly player: PlayerId | null }
  | { readonly t: 'AwaitingSet'; readonly awaiting: Awaiting | null }
  | { readonly t: 'StateBasedActionsApplied'; readonly actions: readonly SbaAction[] }

  // ── stack / casting ──────────────────────────────────────────────────────
  | { readonly t: 'CastBegan'; readonly pending: PendingCast }
  | { readonly t: 'CastStageSet'; readonly stage: PendingCast['stage'] }
  /**
   * ⚠️ Carries the repriced `problem`, exactly as `XChosen` does below, because
   * the targets are what price the ward surcharge (CR 601.2c before 601.2f).
   * Having the reducer recompute it from the oracle instead would make `apply`
   * something other than a pure function of `(state, event)`.
   */
  | { readonly t: 'TargetsChosen'; readonly targets: readonly TargetChoice[]; readonly problem: PendingCast['problem'] }
  | { readonly t: 'XChosen'; readonly x: number; readonly problem: PendingCast['problem'] }
  | { readonly t: 'CastCancelled'; readonly stackId: StackId }
  | { readonly t: 'SpellCast'; readonly obj: StackObject }
  | { readonly t: 'AbilityPutOnStack'; readonly obj: StackObject }
  /**
   * Targets chosen for an object ALREADY on the stack — a triggered ability, and
   * only a triggered ability.
   *
   * ⚠️ Deliberately not `TargetsChosen`, which writes to `pendingCast`: a
   * trigger never has one. CR 603.3d puts the object on the stack and chooses
   * its targets as one action, so the object exists first and this fills it in
   * on the same uninterruptible pass — nobody can act in the gap, because an
   * `Awaiting` blocks every intent (D136's precedent, same shape).
   */
  /**
   * The colour a permanent was given as it entered (CR 614.12).
   *
   * ⚠️ On the LOG, like every other state change, because `chosenColor` is part
   * of `GameState` and so of the state hash — a replay that recomputed it would
   * have to re-ask a question nobody is there to answer.
   */
  /**
   * The replacement funnel suspended, holding an event nobody has applied
   * (CR 616). See `PendingReplacement`.
   *
   * ⚠️ ON THE LOG, because the held event is part of `GameState` while it waits
   * and so of the state hash. A replay that recomputed which effects applied
   * would be re-deciding a question the player already answered.
   */
  | { readonly t: 'ReplacementPending'; readonly pending: PendingReplacement }
  /** The funnel resumed; whatever it produced follows this event. */
  | { readonly t: 'ReplacementResolved' }
  | { readonly t: 'ColorChosen'; readonly card: InstanceId; readonly color: ColorLetter }
  | { readonly t: 'StackTargetsSet'; readonly stackId: StackId; readonly targets: readonly TargetChoice[] }
  | { readonly t: 'CommanderCastCountIncreased'; readonly card: InstanceId; readonly to: number }
  | {
      readonly t: 'StackResolved';
      readonly stackId: StackId;
      readonly card: InstanceId | null;
      readonly to: ZoneRef | null;
      /** What it was aimed at, so an assisted card can still be offered after it resolves. */
      readonly targets: readonly TargetChoice[];
      /**
       * WHO CONTROLLED IT, for the same reason `targets` is here and it is not
       * optional.
       *
       * ⚠️ The stack object is gone by the time anything downstream asks, and
       * the card cannot answer for it: `clearBattlefieldFields` resets a moved
       * card's `controller` to its OWNER, so a resolved spell in a graveyard
       * says only whose card it is. Without this the assisted offer (D90) had no
       * idea whose spell it was and named whoever happened to be looking —
       * which in a hotseat is routinely somebody else, and Ben's Thrill of
       * Possibility drew two cards for Ana. See D120.
       */
      readonly controller: PlayerId;
    }
  | { readonly t: 'SpellFizzled'; readonly stackId: StackId }
  | { readonly t: 'SpellCountered'; readonly stackId: StackId }
  | { readonly t: 'PendingTriggersAdded'; readonly triggers: readonly PendingTrigger[] }
  | { readonly t: 'PendingTriggersCleared'; readonly ids: readonly string[] }
  /**
   * A player's answer to a "may" trigger (CR 603.1), recorded before the
   * ability resolves in the same batch.
   *
   * ⚠️ A MARKER — `apply` returns the state unchanged, exactly as
   * `StateBasedActionsApplied` does. The consequences travel as their own
   * events beside it. It is here because a DECISION is the one thing the
   * resolution's own events cannot show: a declined trigger and a trigger whose
   * effect happened to do nothing produce an identical board, and the log is
   * the only place the difference can live. It is also what lets the fuzz gate
   * count both answers rather than assume it reached them.
   */
  | { readonly t: 'OptionalTriggerAnswered'; readonly stackId: StackId; readonly player: PlayerId; readonly accept: boolean }
  /**
   * A player's answer to an "as this enters, you may pay N life" replacement
   * (CR 614.12), recorded before its consequence in the same batch. See D136.
   *
   * ⚠️ A MARKER, for `OptionalTriggerAnswered`'s reason and one more of its own:
   * paying the life is a `LifeChanged` indistinguishable from any other, and
   * DECLINING is a `PermanentsTapped` indistinguishable from a land tapped for
   * mana. Without this the log could not say a question had been asked at all,
   * and the fuzz canary could not tell the two answers apart.
   */
  | { readonly t: 'EntersChoiceAnswered'; readonly card: InstanceId; readonly player: PlayerId; readonly pay: boolean }

  // ── combat ───────────────────────────────────────────────────────────────
  | { readonly t: 'CombatBegan' }
  | {
      readonly t: 'AttackersDeclared';
      readonly attackers: readonly { readonly card: InstanceId; readonly defender: DefenderRef }[];
    }
  | {
      readonly t: 'BlockersDeclared';
      readonly blocks: readonly { readonly blocker: InstanceId; readonly attacker: InstanceId }[];
    }
  | { readonly t: 'AttackerBecameBlocked'; readonly attackers: readonly InstanceId[] }
  | { readonly t: 'BlockerOrderSet'; readonly attacker: InstanceId; readonly order: readonly InstanceId[] }
  | { readonly t: 'AttackerOrderSet'; readonly blocker: InstanceId; readonly order: readonly InstanceId[] }
  | { readonly t: 'FirstStrikeSubstepDecided'; readonly needed: boolean }
  | {
      readonly t: 'CombatDamageDealt';
      readonly substep: 'firstStrike' | 'regular';
      readonly damages: readonly ResolvedDamage[];
    }
  | { readonly t: 'RemovedFromCombat'; readonly cards: readonly InstanceId[] }
  | { readonly t: 'CombatEnded' }

  // ── non-combat effects ───────────────────────────────────────────────────
  /**
   * Damage from a spell or ability rather than from combat.
   *
   * ⚠️ Carries the SAME `ResolvedDamage` payload as `CombatDamageDealt` and is
   * applied by the same reducer branch, so infect, wither, deathtouch and the
   * commander-damage tally cannot drift between the two ways damage happens.
   * It is a separate event only because the two are different CAUSES: combat
   * damage is a turn-based action, this is a resolving object, and the log and
   * the animation want to say which.
   */
  | { readonly t: 'DamageDealt'; readonly damages: readonly ResolvedDamage[] }
  /**
   * A P/T modifier that lasts until the end of this turn (CR layer 7c).
   *
   * ⚠️ Kept as a LIST on the state rather than folded into the card, because
   * "until end of turn" has to be undone at cleanup and a folded value could not
   * be told apart from a counter or from a Tier-3 override. `derive` sums them
   * at 7c, which is where CR puts them and after `ptOverride` at 7b — so a
   * manual "this is a 4/4 now" plus a Giant Growth still reads as a 7/7.
   */
  | {
      readonly t: 'PtModifiedUntilEndOfTurn';
      readonly card: InstanceId;
      readonly power: number;
      readonly toughness: number;
    }
  /** Cleanup, CR 514.2. Every until-end-of-turn modifier ends at once. */
  | { readonly t: 'UntilEndOfTurnEnded' }

  // ── Tier-3 manual tools + rewind ─────────────────────────────────────────
  /**
   * A marker, not a state change. The state change goes through the ordinary
   * events above with `cause.kind === 'manual'`; this records WHAT the player
   * asked for, verbatim, so the log can always distinguish automated from
   * hand-waved. In a friends game that is a trust feature, not a nicety.
   */
  | { readonly t: 'ManualAction'; readonly player: PlayerId; readonly tool: string; readonly detail: string }
  | { readonly t: 'DiceRolled'; readonly player: PlayerId; readonly sides: number; readonly result: number }
  | { readonly t: 'CoinFlipped'; readonly player: PlayerId; readonly heads: boolean }
  | { readonly t: 'RewindProposed'; readonly proposer: PlayerId; readonly toEventCount: number }
  | { readonly t: 'RewindVoted'; readonly player: PlayerId; readonly agree: boolean }
  | { readonly t: 'RewindCancelled' }
  | { readonly t: 'RewoundTo'; readonly eventCount: number; readonly hash: string }

  // ── narration ────────────────────────────────────────────────────────────
  | {
      readonly t: 'Narrated';
      /**
       * The canonical third-person rendering. ⚠️ DERIVED from `parts` by
       * `narrated()` and never written by hand — this is what goes on disk, what
       * the state hash covers, and what a spectator reads.
       */
      readonly text: string;
      /**
       * Whose line this is. On the EVENT rather than derived at projection
       * time, because only the code that wrote the sentence knows: a resolution
       * during someone else's turn belongs to the spell's controller, not to
       * the active player, and `cause.player` is empty for everything the rules
       * do on their own.
       *
       * ⚠️ This is the log's COLOUR, not the sentence's subject. See `narrate.ts`.
       */
      readonly player: PlayerId | null;
      readonly identity: readonly ColorLetter[];
      readonly manual: boolean;
      /**
       * The line's fragments, so a reader can be shown their own seat in the
       * second person without the engine ever knowing who is reading. See
       * `narrate.ts`. Still "the outcome, not the instruction": every name is
       * already resolved, so the reducer looks nothing up.
       */
      readonly parts: readonly NarrationPart[];
    };

export type EventKind = EventBody['t'];

export interface EventCause {
  readonly kind: 'rules' | 'intent' | 'manual' | 'trigger' | 'rewindCompensation';
  readonly player?: PlayerId;
  readonly intent?: string;
  readonly ability?: AbilityRef;
}

export const RULES_CAUSE: EventCause = { kind: 'rules' };

/**
 * A log line. `seq` is dense from 0; `stepId` groups everything one unit of
 * engine work produced, which is exactly the choreographer's grouping key.
 */
export interface GameEvent {
  readonly seq: number;
  readonly stepId: number;
  readonly body: EventBody;
  readonly cause: EventCause;
  /** Present only on events that consumed randomness. Replay checks both. */
  readonly rngBefore?: RngState;
  readonly rngAfter?: RngState;
}
