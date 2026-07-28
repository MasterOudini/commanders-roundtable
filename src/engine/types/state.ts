// `GameState` — the whole authoritative game, in one immutable value.
//
// SHAPE: flat card map + ordered id arrays per zone. Chosen over nested arrays
// of objects because (a) every zone change is then an id splice, which is cheap
// and trivially diffable for the M4 wire patch, and (b) a card is reachable in
// O(1) from anywhere — the stack, combat and attachments all hold ids, never
// object references, so there is exactly one copy of a card's truth and no way
// for two references to drift apart.
//
// DERIVED CHARACTERISTICS ARE NOT STORED. Power, toughness, keywords and types
// are computed by `derive()` on demand. Storing them would mean every effect
// that changes one has to remember to recompute the others, which is the
// classic way a rules engine ends up with a 3/3 that dies to 2 damage.

import type { ColorLetter } from '../../data/cardTypes';
import type { RngState } from '../rng';
import type {
  AbilityRef,
  IdCounters,
  InstanceId,
  OracleId,
  PlayerId,
  PrintingId,
  StackId,
  ZoneRef,
} from './ids';
import type { ManaPool, PaymentProblem } from './mana';
import type { NarrationPart } from './narration';
import type { TargetSpec } from './oracle';

export type Phase =
  | 'beginning'
  | 'precombatMain'
  | 'combat'
  | 'postcombatMain'
  | 'ending';

export type Step =
  | 'untap'
  | 'upkeep'
  | 'draw'
  | 'precombatMain'
  | 'beginCombat'
  | 'declareAttackers'
  | 'declareBlockers'
  | 'firstStrikeDamage'
  | 'combatDamage'
  | 'endCombat'
  | 'postcombatMain'
  | 'end'
  | 'cleanup';

export type LossReason =
  | 'life'
  | 'emptyLibrary'
  | 'commanderDamage'
  | 'poison'
  | 'conceded';

export type GamePhase = 'lobby' | 'mulligan' | 'playing' | 'finished';

export interface GameOptions {
  readonly startingLife: number;
  readonly startingHandSize: number;
  readonly commanderDamageThreshold: number;
  readonly maxLandsPerTurn: number;
  /** Common Commander house rule, not in the CR. Default on (spec Q2). */
  readonly freeFirstMulligan: boolean;
  /** CR 903.9a. 'ask' teaches the rule; 'always' hides a real choice (Q3). */
  readonly commanderZoneReplacement: 'ask' | 'always' | 'never';
  /** Turns automatic combat damage into a pre-filled proposal (Q5). */
  readonly manualCombatDamageAssignment: boolean;
  readonly poisonThreshold: number;
}

export const DEFAULT_OPTIONS: GameOptions = {
  startingLife: 40,
  startingHandSize: 7,
  commanderDamageThreshold: 21,
  maxLandsPerTurn: 1,
  freeFirstMulligan: true,
  commanderZoneReplacement: 'ask',
  manualCombatDamageAssignment: false,
  poisonThreshold: 10,
};

export interface StopPolicy {
  readonly mode: 'auto' | 'fullControl';
  readonly alwaysStop: Readonly<Partial<Record<Step, boolean>>>;
  readonly stopOnMyUpkeep: boolean;
  /** The stack grew since I last held priority. */
  readonly stopWhenAnyoneCasts: boolean;
  /** Only when I have a creature in combat. */
  readonly stopBeforeCombatDamage: boolean;
  /** The Arena default: stop iff I actually *can* do something. */
  readonly stopWhenIHaveInstantSpeedPlay: boolean;
  /** One-turn override, cleared at TurnBegan. */
  readonly fullControlThisTurn: boolean;
}

export const DEFAULT_STOPS: StopPolicy = {
  mode: 'auto',
  alwaysStop: { declareAttackers: true, declareBlockers: true },
  stopOnMyUpkeep: false,
  stopWhenAnyoneCasts: true,
  stopBeforeCombatDamage: true,
  stopWhenIHaveInstantSpeedPlay: true,
  fullControlThisTurn: false,
};

export interface MulliganState {
  /** How many mulligans this player has taken. */
  readonly taken: number;
  /** They have kept and (if needed) bottomed. */
  readonly kept: boolean;
  /** Cards still to put on the bottom before the game can start. */
  readonly toBottom: number;
}

export interface PlayerState {
  readonly id: PlayerId;
  readonly name: string;
  readonly seat: number;
  readonly life: number;
  readonly poison: number;
  readonly pool: ManaPool;
  /**
   * Keyed by the COMMANDER'S INSTANCE ID, not by player.
   *
   * ⚠️ This is what makes a partner pair track separately at zero extra cost,
   * makes damage from two different commanders never pool (CR 903.10a), and lets
   * a Tier-3 "this creature is now your commander" start a fresh tally — all
   * without a single branch. The 21-damage check is `some(v => v >= threshold)`.
   */
  readonly commanderDamage: Readonly<Record<InstanceId, number>>;
  readonly commanderIds: readonly InstanceId[];
  readonly landsPlayedThisTurn: number;
  readonly maxLandsPerTurn: number;
  readonly hasLost: boolean;
  readonly lossReason: LossReason | null;
  /** Set by a draw from an empty library; the SBA reads it on the NEXT pass. */
  readonly drewFromEmptyLibrary: boolean;
  readonly mulligan: MulliganState;
  readonly stops: StopPolicy;
  readonly connected: boolean;
  /** Commander colour identity — drives the seat nameplate's gradient. */
  readonly identity: readonly ColorLetter[];
  /** Sticky per-game answer to the CR 903.9a prompt ("always do this"). */
  readonly commanderZoneAlways: boolean | null;
}

export interface CardInstance {
  readonly id: InstanceId;
  readonly oracleId: OracleId;
  readonly printingId: PrintingId;
  readonly owner: PlayerId;
  readonly controller: PlayerId;
  readonly zone: ZoneRef;
  readonly tapped: boolean;
  readonly faceDown: boolean;
  readonly faceIndex: number;
  readonly damage: number;
  /** Any of this turn's damage came from a deathtouch source. */
  readonly deathtouchDamage: boolean;
  readonly counters: Readonly<Record<string, number>>;
  readonly attachedTo: InstanceId | null;
  readonly attachments: readonly InstanceId[];
  /** The turn number it last entered the battlefield; null off the battlefield. */
  readonly summonedOnTurn: number | null;
  readonly isCommander: boolean;
  readonly isToken: boolean;
  /** CR 903.8. Survives zone changes, which is the whole point. */
  readonly commanderCastCount: number;
  /** Tier-3 manual override, applied at layer 7d. */
  readonly ptOverride: { readonly power: number; readonly toughness: number } | null;
  /** Tier-3 manual type-line override, applied at layer 4. */
  readonly typeOverride: string | null;
  /** Players who may see this card even though its zone is hidden. */
  readonly revealedTo: readonly PlayerId[];
  readonly phasedOut: boolean;
}

export type DefenderRef =
  | { readonly kind: 'player'; readonly id: PlayerId }
  | { readonly kind: 'permanent'; readonly id: InstanceId };

export interface AttackerDecl {
  readonly card: InstanceId;
  readonly defender: DefenderRef;
  /**
   * ⚠️ STICKY. Set when at least one blocker was declared, and never cleared
   * even if every blocker then leaves combat. CR 509.1h: an attacker that
   * *became blocked* deals no damage to the defending player, which is the rule
   * that stops "block with a chump, sacrifice it, damage goes through anyway".
   */
  readonly becameBlocked: boolean;
  /** Damage assignment order, set by the attacking player when there are ≥2. */
  readonly blockerOrder: readonly InstanceId[];
  readonly dealtFirstStrikeDamage: boolean;
}

export interface BlockerDecl {
  readonly card: InstanceId;
  readonly attackerOrder: readonly InstanceId[];
  readonly dealtFirstStrikeDamage: boolean;
}

export interface CombatState {
  readonly attackers: readonly AttackerDecl[];
  readonly blockers: readonly BlockerDecl[];
  readonly hasFirstStrikeSubstep: boolean;
}

export type TargetChoice =
  | { readonly kind: 'card'; readonly id: InstanceId }
  | { readonly kind: 'player'; readonly id: PlayerId }
  | { readonly kind: 'stack'; readonly id: StackId };

export interface StackObject {
  readonly id: StackId;
  readonly kind: 'spell' | 'activated' | 'triggered';
  readonly controller: PlayerId;
  /** The card that is on the stack; null for an ability (a chit, not a card). */
  readonly card: InstanceId | null;
  /** The permanent an ability came from. */
  readonly source: InstanceId | null;
  readonly abilityRef: AbilityRef | null;
  readonly targets: readonly TargetChoice[];
  readonly modes: readonly number[];
  readonly xValue: number | null;
  readonly label: string;
  readonly identity: readonly ColorLetter[];
  readonly taxApplied: number;
  readonly isCommanderCast: boolean;
  /** Where the card came from, so a fizzle/counter can send it home. */
  readonly castFrom: ZoneRef | null;
}

/**
 * ⚠️ THE UNION'S TEXTUAL ORDER IS NOT THE STATE ORDER. CR 601.2b announces modes
 * **and the value of X**; 601.2c announces targets. So a cast runs
 * `modes → x → targets → pay → ready`, and `'targets'` appearing before `'x'`
 * here is a historical accident of how the union was written.
 *
 * It matters: ~172 cards read `X target creatures`, where the number of targets
 * IS X. Asking for targets first makes those cards unaskable. Targets still
 * precede payment (601.2f), which is what lets the ward surcharge be priced from
 * what the player is actually pointing at.
 */
export type CastStage = 'modes' | 'targets' | 'x' | 'pay' | 'ready';

/**
 * ⚠️ Casting lives in GAME STATE, not in the React store.
 *
 * That is the difference between "Bob dropped while choosing targets" being
 * recoverable and being fatal: the host holds the half-finished cast, so a
 * reconnecting client is handed it back in the snapshot and carries on.
 */
export interface PendingCast {
  readonly player: PlayerId;
  readonly card: InstanceId;
  readonly from: ZoneRef;
  readonly stackId: StackId;
  readonly stage: CastStage;
  readonly kind: 'spell' | 'ability';
  readonly abilityRef: AbilityRef | null;
  readonly modes: readonly number[];
  readonly targets: readonly TargetChoice[];
  readonly xValue: number | null;
  readonly problem: PaymentProblem;
  readonly paidSoFar: ManaPool;
  readonly lifePaid: number;
  readonly isCommanderCast: boolean;
  readonly taxApplied: number;
}

export interface PendingTrigger {
  readonly id: string;
  readonly source: InstanceId;
  readonly controller: PlayerId;
  readonly abilityRef: AbilityRef;
  readonly label: string;
  readonly optional: boolean;
}

/**
 * Every point at which the engine stops and waits for a human.
 *
 * ⚠️ A STAGE THAT STOPS MUST EMIT ONE. `Awaiting` is the only prompt channel that
 * crosses the wire — `GameState` never does, and `PlayerView` carries no
 * `pendingCast` — so a stage that halts without setting one is invisible to every
 * client, including the host's own UI, which runs through a `loopbackPair` like
 * everyone else. It is also what makes `advance()` stop instead of falling
 * through to `priority()` and auto-passing on the player's behalf.
 *
 * ⚠️ D61: this union crosses the wire WHOLE, because every field in every variant
 * is a public game object. Re-read D61 before adding a variant — one that carried
 * (say) "choose a card from your hand" would need redacting.
 */
export type Awaiting =
  | { readonly kind: 'mulligan'; readonly players: readonly PlayerId[]; readonly submitted: readonly PlayerId[] }
  | { readonly kind: 'mulliganBottom'; readonly player: PlayerId; readonly count: number }
  /**
   * ⚠️ Carries the legal choices because a client cannot compute them: they need
   * `canAttack`/`legalDefenders`, which read a `GameState` no client holds. Until
   * this existed the UI hardcoded "the first opponent", so nobody at a 4-player
   * table could choose whom they attacked.
   */
  | {
      readonly kind: 'declareAttackers';
      readonly player: PlayerId;
      readonly attackers: readonly InstanceId[];
      readonly defenders: readonly DefenderRef[];
    }
  /**
   * ⚠️ Carries the legal PAIRINGS for the same reason `declareAttackers` carries
   * its choices: a client cannot compute them. "Can this creature block that
   * attacker" runs through `canBlock`, which reads DERIVED keywords — flying,
   * reach, menace, fear, intimidate, skulk, shadow, horsemanship, protection —
   * off a `GameState` no client holds. Without it the aim veil would have to
   * guess, and a veil that lights up an illegal block is worse than no veil.
   *
   * Every id here is a battlefield permanent, so it is public and D61 holds.
   */
  | {
      readonly kind: 'declareBlockers';
      readonly players: readonly PlayerId[];
      readonly submitted: readonly PlayerId[];
      /** One row per creature that can block at all, with what it may block. */
      readonly legal: readonly { readonly blocker: InstanceId; readonly attackers: readonly InstanceId[] }[];
    }
  | { readonly kind: 'orderBlockers'; readonly player: PlayerId; readonly attacker: InstanceId }
  | { readonly kind: 'orderAttackers'; readonly player: PlayerId; readonly blocker: InstanceId }
  | { readonly kind: 'orderTriggers'; readonly player: PlayerId; readonly triggers: readonly string[] }
  | { readonly kind: 'chooseLegendKeep'; readonly player: PlayerId; readonly name: string; readonly candidates: readonly InstanceId[] }
  /**
   * CR 903.9a. A QUEUE, not a single card: a wrath can put both halves of a
   * partner pair into the graveyard at once, and asking about one while
   * silently abandoning the other would lose a commander with no way back but a
   * Tier-3 tool. Answering pops the head and re-arms for the next.
   */
  | {
      readonly kind: 'commanderZoneChoice';
      readonly player: PlayerId;
      readonly queue: readonly { readonly player: PlayerId; readonly card: InstanceId; readonly from: ZoneRef }[];
    }
  | { readonly kind: 'assignCombatDamage'; readonly player: PlayerId; readonly attacker: InstanceId }
  /**
   * CR 601.2b. Its own prompt because a cast that stops must say so — see the
   * note on this union. Without it the X stage halted invisibly and the caster
   * could auto-pass, stranding a card in the stack zone with a live
   * `pendingCast` and no `StackObject`; `checkInvariants` skips stack-zone cards,
   * so nothing caught it.
   */
  | { readonly kind: 'chooseX'; readonly player: PlayerId; readonly stackId: StackId; readonly source: InstanceId; readonly label: string }
  /**
   * CR 601.2c.
   *
   * ⚠️ Carries the whole prompt, not just a count, because `PendingCast` lives in
   * `GameState` and `GameState` never crosses the wire. A reconnecting client
   * rebuilds this prompt from the snapshot or the promise that "Bob dropped while
   * choosing targets" is recoverable is an empty one.
   */
  | {
      readonly kind: 'chooseTargets';
      readonly player: PlayerId;
      readonly stackId: StackId;
      /** The minimum still required — Σ spec.min. */
      readonly count: number;
      /** The card being cast, or the permanent whose ability is being activated. */
      readonly source: InstanceId;
      /** `Lightning Bolt` · `Prodigal Sorcerer — {T}: deals 1 damage to any target`. */
      readonly label: string;
      /** One per clause, in printed order. Never empty while this prompt is up. */
      readonly specs: readonly TargetSpec[];
      readonly forKind: 'spell' | 'ability';
    }
  | { readonly kind: 'rewindVote'; readonly proposer: PlayerId; readonly toEventCount: number; readonly agreed: readonly PlayerId[]; readonly declined: readonly PlayerId[] };

export interface PriorityState {
  readonly player: PlayerId | null;
  readonly passedSinceLastAction: readonly PlayerId[];
  /**
   * How many objects have EVER been put on the stack this game.
   *
   * ⚠️ A monotone counter, not the stack's size. The first version recorded
   * "the stack size when this player was last granted priority", which is
   * written at grant time and is therefore always equal to the stack size at
   * the moment the check reads it — so `stopWhenAnyoneCasts` could never fire,
   * and every spell resolved without anyone being offered a response. A size
   * also cannot tell "a spell resolved and another was cast" from "nothing
   * happened", because both leave the stack one object deep.
   */
  readonly stackAdds: number;
  /** Per player: the `stackAdds` value they had already seen when they passed. */
  readonly seenStackAdds: Readonly<Record<PlayerId, number>>;
  readonly awaiting: Awaiting | null;
  /** One-shot: this player gets priority straight back after their action. */
  readonly holdingPriority: PlayerId | null;
}

export interface TurnState {
  readonly turnNumber: number;
  readonly activePlayer: PlayerId;
  readonly phase: Phase;
  readonly step: Step;
  readonly turnBasedActionsDone: boolean;
  /** CR 514.3a — an SBA or trigger during cleanup means another cleanup, with priority. */
  readonly cleanupNeedsRepeat: boolean;
}

/** One rendered narration line. Mirrors `src/view/types.ts` `LogEntry`. */
export interface NarrationLine {
  readonly id: number;
  /**
   * The canonical third-person rendering. ⚠️ DERIVED from `parts`, never written
   * by hand. `project()` renders `parts` again per viewer, so the log can say
   * "You draw a card." to the player who drew without the engine knowing who is
   * reading — see `narrate.ts`.
   */
  readonly text: string;
  /** Whose line it is — the log's edge colour. See the `Narrated` event body. */
  readonly player: PlayerId | null;
  readonly identity: readonly ColorLetter[];
  readonly manual: boolean;
  /** The fragments `text` was rendered from. See `narrate.ts`. */
  readonly parts: readonly NarrationPart[];
}

export interface Zones {
  readonly library: Readonly<Record<PlayerId, readonly InstanceId[]>>;
  readonly hand: Readonly<Record<PlayerId, readonly InstanceId[]>>;
  /** Shared and ordered — a permanent's position is stable across a reorder. */
  readonly battlefield: readonly InstanceId[];
  readonly graveyard: Readonly<Record<PlayerId, readonly InstanceId[]>>;
  readonly exile: Readonly<Record<PlayerId, readonly InstanceId[]>>;
  readonly command: Readonly<Record<PlayerId, readonly InstanceId[]>>;
}

export interface GameState {
  readonly gameId: string;
  readonly options: GameOptions;
  readonly gamePhase: GamePhase;
  readonly seating: readonly PlayerId[];
  readonly players: Readonly<Record<PlayerId, PlayerState>>;
  readonly cards: Readonly<Record<InstanceId, CardInstance>>;
  readonly zones: Zones;
  /** Index 0 is the BOTTOM. The last entry is the top and resolves first. */
  readonly stack: readonly StackObject[];
  readonly turn: TurnState;
  readonly priority: PriorityState;
  readonly combat: CombatState | null;
  readonly pendingCast: PendingCast | null;
  /**
   * P/T modifiers that end at cleanup (CR layer 7c, CR 514.2).
   *
   * ⚠️ A LIST, not a value folded into the card. Two Giant Growths stack, and a
   * folded number could not be told apart from a counter or from the Tier-3 P/T
   * override — both of which have to survive the cleanup that wipes these.
   */
  readonly untilEndOfTurn: readonly {
    readonly card: InstanceId;
    readonly power: number;
    readonly toughness: number;
  }[];
  readonly pendingTriggers: readonly PendingTrigger[];
  readonly winners: readonly PlayerId[];
  readonly rng: RngState;
  readonly eventCount: number;
  readonly counters: IdCounters;
  /** The last 200 narration lines, so projection is a slice rather than a rebuild. */
  readonly narration: readonly NarrationLine[];
  /**
   * The choreographer's grouping key. Bumped once per unit of engine work, so
   * every event a single `advance()` produced animates as ONE group.
   */
  readonly stepId: number;
}

/** Throwing accessors. `noUncheckedIndexedAccess` makes these worth having. */
export function playerOf(state: GameState, id: PlayerId): PlayerState {
  const p = state.players[id];
  if (!p) throw new Error(`no such player: ${id}`);
  return p;
}

export function cardOf(state: GameState, id: InstanceId): CardInstance {
  const c = state.cards[id];
  if (!c) throw new Error(`no such card instance: ${id}`);
  return c;
}

export function maybeCard(state: GameState, id: InstanceId): CardInstance | undefined {
  return state.cards[id];
}

export function zoneList(state: GameState, zone: ZoneRef): readonly InstanceId[] {
  switch (zone.kind) {
    case 'battlefield':
      return state.zones.battlefield;
    case 'stack':
      return state.stack.map((s) => s.card).filter((c): c is InstanceId => c !== null);
    case 'library':
      return (zone.player && state.zones.library[zone.player]) || [];
    case 'hand':
      return (zone.player && state.zones.hand[zone.player]) || [];
    case 'graveyard':
      return (zone.player && state.zones.graveyard[zone.player]) || [];
    case 'exile':
      return (zone.player && state.zones.exile[zone.player]) || [];
    case 'command':
      return (zone.player && state.zones.command[zone.player]) || [];
  }
}

/** Every player still in the game, in seat order starting at the active player. */
export function apnapOrder(state: GameState, from?: PlayerId): PlayerId[] {
  const start = from ?? state.turn.activePlayer;
  const seats = state.seating;
  const at = Math.max(0, seats.indexOf(start));
  const out: PlayerId[] = [];
  for (let i = 0; i < seats.length; i++) {
    const id = seats[(at + i) % seats.length];
    if (id) out.push(id);
  }
  return out;
}

export function livingPlayers(state: GameState): PlayerId[] {
  return state.seating.filter((p) => !(state.players[p]?.hasLost ?? true));
}
