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
import type { ManaPool, RestrictedMana, SpendRestriction } from './mana';
import type { NarrationPart } from './narration';
import type { Keyword } from './oracle';
import type {
  Awaiting,
  DefenderRef,
  GameOptions,
  LossReason,
  PendingCast,
  PendingAsks,
  PendingReplacement,
  PendingTrigger,
  Phase,
  PreventionShield,
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
  /**
   * WHY this card moved, when the rules know a reason a card can watch for.
   * `undefined` for every ordinary move - a destroy, a bounce, a draw, a token
   * ceasing, a reanimation, a search - and set only where a rule performed one
   * of the three CR actions a printed trigger names by verb (D377):
   *
   * - `sacrifice` - CR 701.17, a permanent its controller sacrificed
   * - `discard`   - CR 701.8a, a card moved from its owner's hand to their graveyard
   * - `cycling`   - CR 702.29a, the discard that IS the cycling cost
   *
   * A cycling discard is BOTH a cycle and a discard, and the printed heads tell
   * them apart ("Whenever you cycle or discard a card" names both; "Whenever you
   * cycle a card" names one), so it carries its own value rather than `discard`
   * plus a flag.
   *
   * ⚠️ **IT RIDES ON THE MOVE, not on the cause.** `EventCause` has five kinds
   * and none of them is a rules ACTION (D177, D230): a sacrifice is an ordinary
   * battlefield-to-graveyard `CardsMoved` and a discard an ordinary
   * hand-to-graveyard one, so a watcher written on the body alone fires on every
   * death and every other hand-to-graveyard move. And `TriggerDef.matches`
   * receives the event BODY rather than the `GameEvent`, so a widened cause would
   * not reach a def at all. Per-MOVE rather than per-EVENT because one
   * `CardsMoved` is one simultaneous batch and nothing says its moves share a
   * reason.
   *
   * ⚠️ **AND IT IS OPTIONAL, WHERE D355 AND D356 MADE THEIR FIELDS REQUIRED.**
   * That rule exists because a field nothing fills is a dead seam `tsc` cannot
   * see - and it has a boundary, which is this: 1,836 shipped card modules
   * construct a `CardsMoved`, and not one of them is a sacrifice or a discard, so
   * required would mean writing `reason: null` into two thousand generated files
   * to say nothing. What keeps it honest instead is `moveReason.test.ts`, which
   * drives every emitter that must fill it, plus a fuzz canary with a floor
   * (D364's answer for `poolSnow`, whose state hash would otherwise have replayed
   * an empty value for ever).
   */
  readonly reason?: MoveReason;
}

/** See `CardMove.reason`. */
export type MoveReason = 'sacrifice' | 'discard' | 'cycling';

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
   * D382 - "The damage can't be prevented." (CR 615.9). Optional, and
   * deliberately so: `ResolvedDamage` is built by hundreds of shipped card
   * modules and writing `unpreventable: false` into every one of them would say
   * nothing (D377's boundary on the required-field rule). What replaces the
   * compiler is `prevention.test.ts`, which pins both directions on the one
   * card that prints the line.
   */
  readonly unpreventable?: boolean;
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
  /** D330 - lethal damage met a regeneration shield: tapped, damage removed, out of combat, not destroyed. */
  | { readonly t: 'regenerated'; readonly card: InstanceId }
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
  /** D332 - CR 724: the crown moves to `player`. */
  | { readonly t: 'MonarchChanged'; readonly player: PlayerId }
  /**
   * D364 - `snow` says the SOURCE was a snow permanent (CR 107.4s), so the mana
   * this adds can pay `{S}`. REQUIRED on purpose: an optional flag a new emitter
   * forgets type-checks perfectly and silently makes ordinary mana.
   */
  | {
      readonly t: 'ManaAdded';
      readonly player: PlayerId;
      readonly mana: ManaPool;
      readonly source: InstanceId | null;
      readonly snow: boolean;
      /**
       * D397 - the SPEND RESTRICTION this mana carries, when its source printed one the
       * engine read. Optional, unlike `snow`: two dozen shipped spell scripts emit a plain
       * `ManaAdded` (Dark Ritual, Rite of Flame ...) and none of them is restricted; the
       * fuzz canary `restrictedManaMade` keeps the emitter that must fill it honest.
       */
      readonly only?: SpendRestriction;
    }
  /**
   * D364 - `snow` is the SUB-POOL of this spend that came from snow mana. D397 - `restricted`
   * is the SUB-POOLS it came from by restriction, REQUIRED: one emitter, and a spend that
   * forgot its buckets would leave restricted mana in the pool after it was spent.
   */
  | { readonly t: 'ManaSpent'; readonly player: PlayerId; readonly mana: ManaPool; readonly snow: ManaPool; readonly restricted: readonly RestrictedMana[] }
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
  /** D343 - the modes a pending cast (a spell or an activation) chose, in printed order. */
  | { readonly t: 'ModesChosen'; readonly modes: readonly number[] }
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
  /**
   * D390 - a resolution parked the players still to be asked. ON THE LOG for `ReplacementPending`'s
   * reason: the queue is state, and a replay must not re-derive an order the players saw.
   */
  | { readonly t: 'AsksQueued'; readonly pending: PendingAsks }
  /** D390 - the last player answered; the batch of sacrifices or discards follows this event. */
  | { readonly t: 'AsksResolved' }
  /**
   * D391 - a proliferate answer, recorded before its counter changes. The reducer ignores it; it
   * exists because the replay hash cannot tell a proliferated counter from any other (D364's
   * rule), so the fuzz canary counts these instead.
   */
  | { readonly t: 'Proliferated'; readonly player: PlayerId; readonly permanents: readonly InstanceId[]; readonly players: readonly PlayerId[] }
  | { readonly t: 'ColorChosen'; readonly card: InstanceId; readonly color: ColorLetter }
  | { readonly t: 'StackTargetsSet'; readonly stackId: StackId; readonly targets: readonly TargetChoice[] }
  /** D343 - the modes a triggered ability already on the stack chose (CR 603.3c). */
  | { readonly t: 'StackModesSet'; readonly stackId: StackId; readonly modes: readonly number[] }
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
  /**
   * D369 - a player's answer to a payment prompt, recorded before its consequence in the
   * same batch. A MARKER for `EntersChoiceAnswered`'s reason: paying is a `ManaSpent` like
   * any other and declining leaves no event of its own, so without this the log could not
   * say a question had been asked, and the fuzz canary could not tell the answers apart.
   */
  | { readonly t: 'PaymentAnswered'; readonly player: PlayerId; readonly paid: boolean; readonly label: string }
  /**
   * A player DREW (CR 121) — the marker beside the `CardsMoved` that did it,
   * with the drawn ids in DRAW ORDER. See D189.
   *
   * ⚠️ A MARKER, for `OptionalTriggerAnswered`'s reason turned inside out: a
   * draw's `CardsMoved` (library → hand) is byte-identical to an
   * Impulse-style TAKE, a tutor to hand, or the manual tool — so "whenever
   * you draw" could not be watched at all (D179's draw-event discriminator;
   * D182's last-drawn memory). Emitted ONLY at the two real-draw sites — the
   * turn's draw step and `drawEvents`, THE one draw rule — and deliberately
   * NOT for opening hands (no ability can be watching before the game) and
   * NOT by `drawFromTop` itself, which the openers share.
   *
   * ⚠️ The ids add no information the paired `CardsMoved` does not already
   * carry — projection treats the pair identically.
   */
  | { readonly t: 'DrewCards'; readonly player: PlayerId; readonly cards: readonly InstanceId[] }

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
  // D330 - CR 701.19: a regeneration shield put on a permanent, and one spent.
  | { readonly t: 'RegenerationShieldAdded'; readonly card: InstanceId }
  | { readonly t: 'Regenerated'; readonly card: InstanceId }
  // D340 - CR 702.112: a creature became renowned.
  | { readonly t: 'BecameRenowned'; readonly card: InstanceId }

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
   * D382 - CR 615. A shield is put up by an effect that says so; the funnel
   * spends it. Both are events because `preventionShields` is part of
   * `GameState` and therefore of the state hash, so a shield the reducer
   * invented would replay differently than it played (D107's rule).
   */
  | { readonly t: 'PreventionShieldsAdded'; readonly shields: readonly PreventionShield[] }
  | {
      readonly t: 'DamagePrevented';
      readonly spends: readonly { readonly id: string; readonly amount: number }[];
      /**
       * D385 - what a CONTINUOUS prevention ability (CR 615, `PreventionDef`)
       * absorbed, by its source and ability. Nothing on the state moves for it -
       * a static spends nothing - so the reducer ignores it; it is on the log so
       * a game can say what happened and the fuzz gate can count it. REQUIRED:
       * the event is built in exactly one place (D355/D356's rule holds).
       */
      readonly statics: readonly { readonly source: InstanceId; readonly abilityId: string; readonly amount: number }[];
    }
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
      /**
       * Tier-2 keywords GAINED until end of turn (D194). Optional so every
       * pre-D194 event replays byte-identically; a keywords-only grant
       * ("gains flying until end of turn") carries power 0 / toughness 0.
       */
      readonly keywords?: readonly Keyword[];
      /** D311 - card types GAINED until end of turn (crew: Artifact, Creature). Read at layer 4. */
      readonly types?: readonly string[];
      /**
       * D394 - "can't block this turn": a restriction with an END, riding the same event as the
       * pumps and grants (power 0 / toughness 0), read by `canBlock`, cleared at cleanup.
       */
      readonly cantBlock?: true;
      /**
       * D399 - "can't be blocked this turn": the evasion with an END, read by `canBlock` for the
       * ATTACKER (CR 509.1b's other side), riding the same event, cleared at cleanup.
       */
      readonly cantBeBlocked?: true;
      /** D395 - the animate family: base P/T (layer 7b), subtypes (layer 4) and colours (layer 5) until end of turn. */
      readonly basePt?: { readonly power: number; readonly toughness: number };
      readonly subtypes?: readonly string[];
      readonly colors?: readonly ('W' | 'U' | 'B' | 'R' | 'G')[];
    }
  /**
   * D393 - THREATEN: `controller` takes the permanent until end of turn and `revertTo` gets it
   * back at cleanup. The permanent came under a player's control this turn (CR 302.6), so the
   * reducer marks it summoning-sick; the printed "It gains haste until end of turn." is what
   * lets it attack. The revert itself is an ordinary `ControlChanged`, emitted by the cleanup
   * step before `UntilEndOfTurnEnded` clears the entry that remembered it.
   */
  | { readonly t: 'ControlChangedUntilEndOfTurn'; readonly card: InstanceId; readonly controller: PlayerId; readonly revertTo: PlayerId }
  /**
   * D396 - a marker beside a bite's or a fight's `DamageDealt` (CR 701.12): who bit whom, and
   * whether the damage went both ways. Nothing in the state moves on it; the fuzz canaries and the
   * narration read it.
   */
  | { readonly t: 'Fought'; readonly subject: InstanceId; readonly other: InstanceId; readonly mutual: boolean }
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
