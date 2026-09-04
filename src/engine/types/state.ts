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
// ⚠️ TYPE-ONLY, and it has to be: `events.ts` imports this module back. A type
// import is erased, so the cycle never exists at runtime.
import type { EventBody } from './events';
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
import type { Keyword, TargetSpec } from './oracle';

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
  readonly poisonThreshold: number;
}

export const DEFAULT_OPTIONS: GameOptions = {
  startingLife: 40,
  startingHandSize: 7,
  commanderDamageThreshold: 21,
  maxLandsPerTurn: 1,
  freeFirstMulligan: true,
  commanderZoneReplacement: 'ask',
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
  /**
   * The colour named by "As this ~ enters, choose a color." (CR 614.12).
   *
   * ⚠️ **A COLOUR, NOT A GENERAL `chosen`, AND THE NARROWNESS IS THE POINT.**
   * D136 measured the "as ~ enters, choose" family at 162 cards and called a
   * `chosen` field the primitive — and it was right that the FIELD is the
   * primitive rather than the question. But the family is three shapes with
   * three consumers, and only one of those consumers exists:
   *   · **colour (52 lines)** — read by `{T}: Add one mana of the chosen color`,
   *     which `parseManaProduction` already models as an `anyColor` scope. So
   *     the engine can consume it TODAY, and `Sol Grail` is the whole card in
   *     two lines.
   *   · **creature type (58)** and **opponent (12)** — read only by card text
   *     that needs a script (M6.4). Asking those questions now would store an
   *     answer nothing reads: D136's "a prompt as theatre, worse than the
   *     silence it replaced".
   * A general field with two members nothing populates is that same theatre with
   * a wider type. When those consumers land, they bring their own field.
   *
   * ⚠️ Cleared by `clearBattlefieldFields` like every other battlefield-only
   * fact, so a permanent that leaves and re-enters is asked again (CR 400.7).
   */
  readonly chosenColor: ColorLetter | null;
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
  /**
   * D299: which target CLAUSE each entry of `targets` answers — an index into
   * the face's `targets` specs, the same length as `targets`, fixed when the
   * declaration was validated so a counted or optional clause finds ITS picks
   * at resolution. Absent on abilities, triggers, the assisted path and older
   * logs, where the consumer aims clause i at `targets[i]` as it always has.
   */
  readonly targetSlots?: readonly number[];
  readonly modes: readonly number[];
  readonly xValue: number | null;
  readonly label: string;
  readonly identity: readonly ColorLetter[];
  readonly taxApplied: number;
  readonly isCommanderCast: boolean;
  /** Where the card came from, so a fizzle/counter can send it home. */
  readonly castFrom: ZoneRef | null;
  /** D309 - cast face down (morph): a nameless colorless 2/2 creature spell. */
  readonly faceDown?: true;
  /**
   * The ITEM a per-item fan-out firing is about (D190), carried from
   * `PendingTrigger.item` so `resolve` can read which drawn card / dealer /
   * tapped permanent THIS firing answers. Absent on every other object.
   */
  readonly item?: InstanceId;
  /**
   * Which face was cast — CR 712, a modal DFC's back face.
   *
   * ⚠️ **THE SPELL CARRIES IT, NOT THE CARD, AND THAT IS FORCED**: every zone
   * change runs `clearBattlefieldFields`, which resets `CardInstance.faceIndex`
   * to 0 (right for CR 400.7 and for a TRANSFORM permanent that dies as its
   * front face). A modal DFC's face is a property of the SPELL and has to
   * survive hand → stack → battlefield, so it rides here and is re-applied with
   * a `FaceIndexSet` after each move. See D155.
   */
  readonly faceIndex: number;
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
/**
 * **THE REPLACEMENT FUNNEL, SUSPENDED MID-FOLD.** CR 616.1: when two or more
 * replacement effects would apply to one event, the affected object's controller
 * chooses which applies first, then the question is asked again of what is left.
 *
 * ⚠️ **THIS IS A CONTINUATION, AND IT HAD TO BE.** `applyReplacements` is pure
 * `(state, events) => events` and cannot stop to ask. D136 solved its
 * pay-to-enter prompt by letting the event happen and asking afterwards — that
 * trick is unavailable here, because the ORDER changes the outcome: `Hardened
 * Scales` before `Branching Evolution` turns two counters into six, the other
 * way round gives five. So the event is HELD, unapplied, until the answer comes.
 *
 * ⚠️ **TWO QUEUES, BECAUSE CR 614.5 IS PER-EVENT.** "An effect applies at most
 * once to a given event" — so `used` covers `event` and everything it fans out
 * into (`siblings`), and the rest of the batch (`rest`) starts over with an
 * empty set. Sharing one set across the batch would let a replacement fire on
 * the first `CountersChanged` of a wrath and on none of the others.
 *
 * ⚠️ The fan-out needs no nesting: every level of it shares one `used`, so a
 * replacement that turns one event into three simply splices them into
 * `siblings` and the loop carries on. Only the batch boundary needs a second
 * queue.
 */
export interface PendingReplacement {
  /** The event being replaced. NOT yet applied — that is the whole point. */
  readonly event: EventBody;
  /** Who chooses. CR 616.1 — the affected object's controller, or its owner. */
  readonly player: PlayerId;
  /** `${sourceId}#${abilityId}` already applied to this event (CR 614.5). */
  readonly used: readonly string[];
  /** The rest of this event's fan-out. Shares `used`. */
  readonly siblings: readonly EventBody[];
  /**
   * The rest of what the BUILT-IN replacements produced for this body. Each
   * starts with an empty `used`, and the built-ins have already run on them.
   */
  readonly rest: readonly EventBody[];
  /**
   * The rest of the BATCH — raw bodies the built-ins have not seen yet.
   *
   * ⚠️ **THREE QUEUES BECAUSE THE PIPELINE HAS THREE STAGES**, and collapsing
   * any two of them would be wrong in a way that stays invisible until it bites:
   * `siblings` shares CR 614.5's `used` and these two do not, and the built-ins
   * are NOT idempotent — re-running `withEntryCounters` over a `CardsMoved` it
   * has already seen adds the loyalty a second time.
   */
  readonly queued: readonly EventBody[];
}

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
  /** D309 - a face-down (morph) cast. */
  readonly faceDown?: true;
  /** The modal DFC face being cast, carried to the `StackObject`. See D155. */
  readonly faceIndex: number;
  /**
   * The permanent chosen for a "Sacrifice a <predicate>" activation cost
   * (D168), validated at activation and charged in `finishAbility`'s cost
   * batch. Optional so every pre-D168 pending — and its replay — is
   * untouched.
   */
  readonly sacrifice?: InstanceId;
  /** The cards a "Discard N" cost chose (D286); charged in the cost batch. */
  readonly discard?: readonly InstanceId[];
  /** The permanents a "Tap N untapped …" cost chose (D286); tapped in the cost batch. */
  readonly tap?: readonly InstanceId[];
  /** D299: the clause each declared target answers, carried to the `StackObject`. */
  readonly targetSlots?: readonly number[];
}

export interface PendingTrigger {
  readonly id: string;
  readonly source: InstanceId;
  readonly controller: PlayerId;
  readonly abilityRef: AbilityRef;
  readonly label: string;
  readonly optional: boolean;
  /**
   * The ITEM this firing is about, when its def fanned a batched event out
   * per item (D190) — the dealing creature, the tapped permanent, the drawn
   * card. Rides onto `StackObject.item` so `resolve` can read it. Optional so
   * every pre-D190 pending — and its replay — is untouched.
   */
  readonly item?: InstanceId;
  /**
   * One per printed target clause, copied from the `TriggerDef` when the bus
   * found it. Empty for the overwhelming majority of triggers.
   *
   * ⚠️ Copied rather than looked up again at drain time because the def is
   * reachable only through the registry, and `PendingTrigger` is part of
   * `GameState` — which replays without one.
   */
  readonly specs: readonly TargetSpec[];
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
 *
 * ⚠️ A VARIANT NEEDS AN ANSWERING INTENT AND A CLIENT THAT CAN COMPUTE THE
 * ANSWER — not one of the two. `assignCombatDamage` lived here with neither: no
 * `AssignCombatDamage` in `intents.ts`, no button in `PromptBar`, and reachable
 * only through an option no screen could set. `orderAttackers` had both halves
 * of an intent and a `PlayerView` that could not express the answer, because
 * `CardView.blocking` was one id. Either shape is a hang the moment something
 * raises it, and a hang is indistinguishable from a healthy idle — D102. The
 * producer side is asserted in `awaitingProducers.node.test.ts`; the answering
 * side by `src/bot/awaiting.ts`'s exhaustive switch. See D125.
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
      /**
       * ⚠️ `'trigger'` is the odd one: a spell or an activated ability is
       * waiting in `pendingCast` and has not reached the stack, where a
       * triggered ability is ALREADY ON THE STACK while this prompt is up
       * (CR 603.3d puts the object there and chooses its targets in one
       * action). So `stackId` names a real object for a trigger and a
       * not-yet-existing one for the other two — read `forKind` before
       * reaching for it.
       */
      readonly forKind: 'spell' | 'ability' | 'trigger';
    }
  /**
   * CR 603.1 — a triggered ability that says "you may". The ability uses the
   * stack like any other; the CHOICE is made by its controller on resolution,
   * which is why this prompt is raised from `resolveTop` and not from the
   * trigger drain.
   *
   * ⚠️ `TriggerDef.optional` has been in the script API since M3 and
   * `collectTriggers` has copied it onto every `PendingTrigger` for as long —
   * with nothing anywhere branching on it, so a "may" trigger fired
   * unconditionally. That is half-execution in the one direction D90 forbids:
   * doing something the player never chose. See D128.
   *
   * `label` is the trigger's own label, already narrated publicly when the
   * ability went on the stack, and `source` is a permanent. D61 holds: every
   * field here is public.
   */
  | {
      readonly kind: 'optionalTrigger';
      readonly player: PlayerId;
      readonly stackId: StackId;
      readonly source: InstanceId;
      readonly label: string;
    }
  /**
   * CR 614.12 — a replacement effect that asks its controller a question as the
   * permanent enters. Today that is exactly one printed shape: "As this land
   * enters, you may pay N life. If you don't, it enters tapped." See D136.
   *
   * ⚠️ **THE FIRST PROMPT RAISED FROM INSIDE `applyReplacements`**, and the only
   * one in this union whose producer is the replacement funnel rather than the
   * priority loop or a cast stage. That is what made it worth building: D135
   * could read the sentence and had nowhere to ask.
   *
   * ⚠️ **THE PERMANENT HAS ALREADY ENTERED when this is up, and it is UNTAPPED.**
   * Suspending the fold mid-batch would mean a continuation in `GameState` —
   * hashable, replayable, and enormous. Instead the entry happens, the question
   * is asked, and the answer appends EITHER the life payment OR the tap. Nobody
   * can act in between (an `Awaiting` blocks every other intent), so the only
   * observer of the gap is a card that triggers on "enters tapped" — which is
   * the same one-event-later shape `withEntersTapped` has had since D134.
   *
   * ⚠️ **A QUEUE, for `commanderZoneChoice`'s reason exactly** (CR 903.9a's
   * note above): one `CardsMoved` can put several such lands onto the
   * battlefield — a Tier-3 zone move, or a spell that puts two lands out — and
   * asking about one while silently tapping the rest is half-execution. The head
   * is this prompt; answering pops it and re-arms for the next.
   *
   * Every field is public: `source` is a battlefield permanent and `life` is
   * printed on it. D61 holds.
   */
  /**
   * CR 616.1 — which of several applicable replacement effects applies next.
   *
   * ⚠️ The options are `${sourceId}#${abilityId}` keys and the printed text of
   * the ability. Both are public: the source is a battlefield permanent and the
   * text is on the card. D61 holds.
   *
   * ⚠️ ONE AT A TIME, not "order them all". That is CR 616.1 exactly — choose
   * one, apply it, then ask again of what remains — and it is also the only
   * version that stays right when applying one effect changes which of the
   * others still apply.
   */
  | {
      readonly kind: 'chooseReplacement';
      readonly player: PlayerId;
      readonly options: readonly { readonly key: string; readonly label: string }[];
    }
  /**
   * ⚠️ **THE ONLY PROMPT IN M6.3 WHOSE ANSWER IS A FACT RATHER THAN AN ACTION.**
   * CR 614.12 — "As this ~ enters, choose a color" is answered as the permanent
   * enters, and the answer is REMEMBERED on the object (`CardInstance.chosenColor`)
   * for every later ability to read. Every other prompt in this union resolves
   * and is gone.
   *
   * ⚠️ Five options, always, and no card ids: the colours are a closed set the
   * client already knows, so this variant carries nothing that could leak (D61).
   */
  | {
      readonly kind: 'chooseColor';
      readonly player: PlayerId;
      readonly source: InstanceId;
      readonly label: string;
    }
  | {
      readonly kind: 'entersChoice';
      readonly player: PlayerId;
      readonly source: InstanceId;
      /** What declining costs: the permanent enters tapped instead. */
      readonly life: number;
      readonly label: string;
      /**
       * The permanents after this one still waiting to be asked about.
       *
       * ⚠️ Each entry carries its own LABEL, so the handler that pops the queue
       * needs no oracle at all. The alternative — looking the name up when the
       * next prompt is built — puts a second reader of the printing beside the
       * funnel that already read it, which is the duplication D122 and D134 both
       * name; and the handler would need `deps` for one string.
       */
      readonly queue: readonly {
        readonly card: InstanceId;
        readonly player: PlayerId;
        readonly life: number;
        readonly label: string;
      }[];
    }
  /**
   * CR 701.8a — a player choosing cards out of their own hand to discard.
   *
   * ⚠️ **THE FIRST PROMPT OVER A HIDDEN ZONE, AND IT CARRIES NO CARD IDS.**
   * Every other variant in this union names battlefield permanents or stack
   * objects, and each says so because `Awaiting` crosses the wire WHOLE (D61) —
   * a redaction pass per prompt kind is exactly the per-kind wire code D61
   * exists to avoid. A hand is hidden, so listing the candidates here would post
   * one player's hand to every client the moment they were asked to discard.
   *
   * So it says only WHO, WHICH ZONE and HOW MANY. The client computes the
   * candidate list from its own `PlayerView`, which already shows a player their
   * own hand — D125's rule that a variant needs a client able to COMPUTE the
   * answer, satisfied by construction rather than by shipping the answer.
   *
   * ⚠️ **RAISED ONLY WHEN THERE IS A CHOICE TO MAKE.** A player holding no more
   * cards than the effect takes discards their whole hand with no prompt (CR
   * 701.8a), and an empty hand discards nothing. Asking anyway would be a
   * question with one legal answer.
   *
   * See D137.
   */
  | {
      readonly kind: 'chooseFromZone';
      readonly player: PlayerId;
      /**
       * `hand` for a discard (D137); `library` for "look at the top N" (D141).
       *
       * ⚠️ **BOTH ARE HIDDEN ZONES AND NEITHER SHIPS CARD IDS.** For a hand the
       * client already sees its own; for a library it sees exactly the cards the
       * rules just revealed to it, through `view.peek` (D114). Listing them
       * here would post one player's library top to every client, which is the
       * same leak the hand case exists to avoid.
       */
      readonly zone: 'hand' | 'library';
      /**
       * Where the cards NOT chosen go — `library` prompts only, `null` for a
       * discard, where the unchosen simply stay in hand.
       */
      readonly rest: 'graveyard' | 'bottom' | 'bottomOrdered' | 'topOrdered' | null;
      /** Exactly this many — never "up to", because no card in the slice says so. */
      readonly count: number;
      /** `Mind Rot` — what is making them do it, for the prompt bar. */
      readonly label: string;
    }
  /**
   * "…in any order" — the player puts a known set of cards into a sequence.
   * `Impulse` bottoms three of four; `Index` re-stacks five. See D142.
   *
   * ⚠️ **NO CARD IDS, for the third time and the same reason** (D137, D141).
   * The cards are the ones the rules just revealed to this player, and the
   * client lists them from `view.peek`. `Awaiting` crosses the wire WHOLE
   * (D61), so putting them here would post a library top to every client.
   *
   * ⚠️ **RAISED ONLY WHEN THERE IS AN ORDER TO CHOOSE.** One card has one
   * sequence, so a single leftover skips the prompt and moves straight away —
   * the same "a question with one legal answer" rule the discard and look
   * prompts already follow.
   *
   * ⚠️ It is deliberately NOT `orderTriggers`, which carries its list because
   * triggers on the stack are public. Same verb, opposite disclosure.
   */
  | {
      readonly kind: 'orderCards';
      readonly player: PlayerId;
      /** Only `library` today; CR 616's ordering will want another. */
      readonly zone: 'library';
      /** Where the sequence is written once it is chosen. */
      readonly destination: 'top' | 'bottom';
      /** How many cards are being ordered — never which. */
      readonly count: number;
      readonly label: string;
    }
  /**
   * CR 701.18/701.42 — scry or surveil (D195): partition the revealed top run
   * into kept-on-top-in-order and sent-away. The FOURTH prompt over a hidden
   * zone and it ships no card ids like the other three — the client lists the
   * candidates from its own `view.peek` (the rules revealed them to it).
   */
  | {
      readonly kind: 'scryChoice';
      readonly player: PlayerId;
      /** How many cards were revealed — never which. */
      readonly count: number;
      /** Surveil sends the rejects to the graveyard instead of the bottom. */
      readonly toGraveyard: boolean;
      /**
       * Cards drawn AFTER the choice resolves ("Scry 2, then draw a card") —
       * carried through the prompt because the draw must see the library AS
       * REORDERED (D195).
       */
      readonly thenDraw: number;
      readonly label: string;
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
   * **The replacement funnel, suspended mid-fold** (CR 616). See
   * `PendingReplacement`.
   */
  readonly pendingReplacement: PendingReplacement | null;
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
    /**
     * Tier-2 keywords the card GAINS until end of turn (D194) — the carrier
     * D153 measured missing under 958 sole-need cards. Optional so every
     * pre-D194 entry and its replay hash are untouched. Read at layer 6 in
     * `derive.ts`, cleared by the same `UntilEndOfTurnEnded` as the P/T.
     */
    readonly keywords?: readonly Keyword[];
    /** D311 - card types gained until end of turn (a crewed Vehicle). Read at layer 4. */
    readonly types?: readonly string[];
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
