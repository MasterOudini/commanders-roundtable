// What a bot may see, what it may do, and how strong it is.
//
// ⚠️ `BotPort` IS THE ANTI-CHEATING STATEMENT, in one screenful. Every member
// is an existing public `ClientSession` method with the identical signature, so
// a `ClientSession` satisfies it structurally with no adapter — and nothing
// outside it is reachable. A bot seat is a client (M4 invariant 6): it holds a
// projected `PlayerView` and a `legal` list the host computed for that seat, and
// it has no `GameState` to cheat with because no client anywhere has one.
//
// ⚠️ `BotSnapshot` is a `Pick`, not a restatement, so it cannot drift from
// `ClientSnapshot`.
//
// ⚠️ `src/bot/` holds the ENGINE's clock rule with the NET's import rule, and
// the difference from `src/net/` is deliberate: the net layer may call
// `setTimeout` because a transport needs backoff, and a bot must not, or pacing
// ends up inside the policy and a headless tournament can never run faster than
// real time. Timers live in `src/game/botSeat.ts` alone.

import type { Intent } from '../engine/types/intents';
import type { InstanceId } from '../engine/types/ids';
import type { TargetChoice } from '../engine/types/state';
import type { TargetSpec } from '../engine/types/oracle';
import type { StopPolicy } from '../engine/types/state';
import type { PlayerView } from '../view/types';
import type { CastPreview, ClientSnapshot } from '../net/client';

/**
 * Everything a bot may ask about the game.
 *
 * ⚠️ Note what is NOT here: `legalActions`, `canAttack`, `canBlock`,
 * `legalDefenders` and `candidatesFromState` all take a `GameState` and are
 * therefore unreachable from a seat. The M6 brief's §3 table lists them as the
 * bot's tools; that table is written from the HOST's side. What the bot actually
 * gets is `snapshot().legal`, shipped per connection, and the legal choices
 * carried inside `declareAttackers` / `declareBlockers` — which exist precisely
 * because a client cannot derive them.
 */
export interface BotPort {
  snapshot(): BotSnapshot;
  currentView(): PlayerView;
  submit(intent: Intent): void;
  previewCast(
    cardId: InstanceId,
    xValue?: number,
    targets?: readonly TargetChoice[],
  ): CastPreview | null;
  legalTargetsFor(specs: readonly TargetSpec[], sourceCard: InstanceId): TargetChoice[];
  targetSpecsFor(cardId: InstanceId, abilityIndex?: number): readonly TargetSpec[];
}

export type BotSnapshot = Pick<
  ClientSnapshot,
  | 'you'
  | 'running'
  | 'finished'
  | 'awaiting'
  | 'priority'
  | 'legal'
  | 'turn'
  | 'eventCount'
  | 'rejectSeq'
  | 'message'
  // ⚠️ For level 0 ONLY, which seeds its RNG from the position rather than
  // carrying mutable state — see `random.ts`. Nothing else reads it.
  | 'stateHash'
>;

/**
 * Difficulty.
 *
 * ⚠️ **0 is not a difficulty setting.** It is the legal-random baseline the M6
 * brief requires every later level to be measured against, it lives in
 * `random.ts`, and it is deliberately NOT offered in the lobby — an opponent
 * whose whole description is "deliberately bad" is not a choice a player wants,
 * and shipping it would make "difficulty" mean two different things.
 */
export type BotLevel = 0 | 1;

export interface BotConfig {
  readonly level: BotLevel;
  /**
   * Varies level 0's draws between tournament runs. Level 1 uses no randomness
   * at all, so this changes nothing for it.
   */
  readonly seed?: string;
  /**
   * How long the bot pauses before acting, so its moves are legible at the
   * table. It decides WHEN the bot acts and never WHAT it does — a headless run
   * sets 0 and gets an identical game.
   */
  readonly thinkMs: number;
}

export const DEFAULT_BOT: BotConfig = { level: 1, thinkMs: 350 };

/**
 * Why the bot could not act, when that is not simply "it is not my turn".
 *
 * ⚠️ These exist because `Intent | null` conflates "this prompt is not mine"
 * with "I have no answer", and D102 is the record of what that costs: the
 * two-instance sign-off read 21/24 for weeks because a driver returned null and
 * a wedged game looks exactly like a healthy idle one. A fault is loud.
 */
export type BotFaultKind =
  | 'noIntentForAwaiting'
  | 'viewCannotExpressMultiBlock'
  | 'noProgress'
  | 'unknownAwaiting';

export type BotDecision =
  | { readonly t: 'act'; readonly intent: Intent; readonly why: string }
  | { readonly t: 'wait'; readonly why: string }
  | { readonly t: 'fault'; readonly kind: BotFaultKind; readonly why: string };

export const wait = (why: string): BotDecision => ({ t: 'wait', why });
export const act = (intent: Intent, why: string): BotDecision => ({ t: 'act', intent, why });
export const fault = (kind: BotFaultKind, why: string): BotDecision => ({ t: 'fault', kind, why });

/**
 * The bot's stop policy, submitted for its own seat at game start.
 *
 * ⚠️ NOT `mode: 'fullControl'`, and that is a correction to the M6 brief's §5,
 * which says to use it "or it will be auto-passed out of decisions it wanted to
 * make". Read `shouldAutoPass` in order: `fullControl` short-circuits BEFORE
 * everything, so every priority window in the game becomes a stop. On `auto`,
 * the first question after that is "could this player do anything at all"
 * (D119) — an empty `meaningfulActions` auto-passes regardless of every other
 * flag — and a land drop never auto-passes. Level 1 responds to nothing, holds
 * no combat trick and casts only at sorcery speed, so the extra windows
 * `fullControl` buys are windows it would only ever pass in, at roughly three
 * times the host's per-window cost.
 *
 * ⚠️ BUT `stopWhenIHaveInstantSpeedPlay` MUST STAY ON, and its name is why this
 * was wrong the first time. Turning it off does not merely drop instant-speed
 * windows — the flag GATES `isStopWindow` entirely:
 *
 *     if (!stops.stopWhenIHaveInstantSpeedPlay) return true;
 *     return !isStopWindow(state, player);
 *
 * and `isStopWindow` is "your own main phases, or somebody else's end step". So
 * switching it off auto-passes the bot out of its OWN MAIN PHASE, which is where
 * every spell it casts is cast. Measured on one seed, 4 seats, with it OFF: the
 * game reached turn 88 having played 73 lands and declared 88 attacks — and cast
 * FOUR SPELLS. With it ON, the same seed casts 21 and blocks 39 against 18. The
 * cost is one extra window per opponent's turn (their end step), where level 1
 * simply passes. `bot.test.ts` asserts the casting floor so this cannot regress
 * quietly — a bot that only plays lands still finishes a game and still replays.
 *
 * When level 2 learns to respond to a spell, turn `stopWhenAnyoneCasts` back on
 * — one field, not the whole mode — and re-measure.
 *
 * ⚠️ `alwaysStop` keeps the human default so the two seats are comparable. It is
 * nearly a no-op: attackers and blockers are `Awaiting` prompts raised by
 * `loop.ts`, not priority stops, so the engine stops there either way.
 */
export const BOT_STOPS: StopPolicy = {
  mode: 'auto',
  alwaysStop: { declareAttackers: true, declareBlockers: true },
  stopOnMyUpkeep: false,
  stopWhenAnyoneCasts: false,
  stopBeforeCombatDamage: false,
  stopWhenIHaveInstantSpeedPlay: true,
  fullControlThisTurn: false,
};
