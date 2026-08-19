// The scenario harness. Every rules test in `src/engine/*.test.ts` builds its
// board through this.
//
// ⚠️ EVERY fixture goes through real events and real `apply`. A test helper that
// hand-built a `GameState` would let a scenario assert on a board the engine
// could never actually produce — which is how a rules suite ends up green while
// the game is broken. `put()` uses the Tier-3 `ManualMoveCard` intent, so even
// "just put a Serra Angel on the battlefield" is a logged, replayable event.

import { Game, type GameOpts } from '../game';
import { ingestOracle } from '../oracle';
import { NO_SCRIPTS, type ScriptRegistry } from '../scripts/registry';
import { ENGINE_CARDS } from '../../data/fixtures/engineCards';
import type { CardData } from '../../data/cardTypes';
import type { EngineDeps } from '../loop';
import type { SetupPlayer, SetupSpec } from '../setup';
import type { InstanceId, PlayerId } from '../types/ids';
import type { Intent } from '../types/intents';
import type { GameOptions, GameState, Step, TargetChoice } from '../types/state';
import type { OracleDb } from '../types/oracle';
import { candidatesFromState, minimumLegalTargets, type TargetingSource } from '../targets';
import { faceOf } from '../oracle';

export const ORACLE: OracleDb = ingestOracle(ENGINE_CARDS).db;

export function deps(scripts: ScriptRegistry = NO_SCRIPTS): EngineDeps {
  return { oracle: ORACLE, scripts };
}

function cardByName(name: string): CardData {
  const card = ORACLE.byName(name);
  if (!card) throw new Error(`no fixture card named "${name}" — add it to scripts/make-engine-fixtures.cjs`);
  return card.data;
}

export interface TestGameOpts {
  readonly players?: number;
  readonly seed?: string;
  /** Card names per player. Padded with Forests to `librarySize`. */
  readonly decks?: readonly (readonly string[])[];
  readonly commanders?: readonly (readonly string[])[];
  readonly librarySize?: number;
  readonly options?: Partial<GameOptions>;
  readonly scripts?: ScriptRegistry;
  readonly startingPlayer?: PlayerId;
  readonly game?: GameOpts;
}

// ⚠️ No seat is called "You" — see the comment on `SEAT_NAMES` in
// `src/game/buildGame.ts`. The engine narrates in the third person.
const NAMES = ['Ana', 'Ben', 'Cy', 'Dee'];
const DEFAULT_COMMANDERS = [
  'Kess, Dissident Mage',
  'Krenko, Mob Boss',
  'Talrand, Sky Summoner',
  "Yeva, Nature's Herald",
];

export function makeSpec(opts: TestGameOpts = {}): SetupSpec {
  const count = opts.players ?? 4;
  const librarySize = opts.librarySize ?? 30;
  const players: SetupPlayer[] = [];
  for (let i = 0; i < count; i++) {
    const id = `p${i + 1}`;
    const names = [...(opts.decks?.[i] ?? [])];
    // Pad with basics so the library is deep enough to draw from and every deck
    // can actually make mana.
    const filler = ['Forest', 'Island', 'Mountain', 'Plains', 'Swamp'];
    let f = 0;
    while (names.length < librarySize) names.push(filler[f++ % filler.length] as string);
    const commanderNames = opts.commanders?.[i] ?? [DEFAULT_COMMANDERS[i % 4] as string];
    const commanders = commanderNames.map((n) => toSetupCard(n));
    players.push({
      id,
      name: NAMES[i] ?? `Player ${i + 1}`,
      commanders,
      library: names.map((n) => toSetupCard(n)),
      identity: cardByName(commanderNames[0] as string).colorIdentity,
    });
  }
  return {
    gameId: 'test',
    seed: opts.seed ?? 'test-seed',
    players,
    ...(opts.options !== undefined ? { options: opts.options } : {}),
    ...(opts.startingPlayer !== undefined ? { startingPlayer: opts.startingPlayer } : { startingPlayer: 'p1' }),
  };
}

function toSetupCard(name: string): { oracleId: string; printingId: string } {
  const card = cardByName(name);
  return { oracleId: card.oracleId, printingId: card.scryfallId };
}

export function newTestGame(opts: TestGameOpts = {}): Game {
  return Game.create(makeSpec(opts), deps(opts.scripts), opts.game ?? {});
}

/** Keep every opening hand, so the game reaches turn 1. */
export function keepAll(game: Game): void {
  for (let guard = 0; guard < 20; guard++) {
    const awaiting = game.state.priority.awaiting;
    if (awaiting?.kind !== 'mulligan') break;
    const next = awaiting.players[0];
    if (!next) break;
    const result = game.submit({ t: 'MulliganDecision', player: next, keep: true });
    if (!result.ok) throw new Error(`keepAll: ${result.message}`);
  }
}

/** A game at turn 1, precombat main, with every hand kept. */
export function startedGame(opts: TestGameOpts = {}): Game {
  const game = newTestGame(opts);
  keepAll(game);
  return game;
}

export function must(result: ReturnType<Game['submit']>): void {
  if (!result.ok) throw new Error(`intent rejected: ${result.reason} — ${result.message}`);
}

export function idsIn(
  game: Game,
  player: PlayerId,
  zone: 'library' | 'hand' | 'graveyard' | 'exile' | 'command',
): InstanceId[] {
  return [...(game.state.zones[zone][player] ?? [])];
}

export function battlefieldOf(game: Game, player: PlayerId): InstanceId[] {
  return game.state.zones.battlefield.filter((id) => game.state.cards[id]?.controller === player);
}

export function nameOf(game: Game, id: InstanceId): string {
  const card = game.state.cards[id];
  if (!card) return '<gone>';
  return ORACLE.byPrinting(card.printingId)?.name ?? '<unknown>';
}

/** Find a card by NAME in a zone. Throws rather than returning undefined. */
export function find(
  game: Game,
  player: PlayerId,
  zone: 'library' | 'hand' | 'graveyard' | 'exile' | 'command' | 'battlefield',
  name: string,
): InstanceId {
  const ids = zone === 'battlefield' ? battlefieldOf(game, player) : idsIn(game, player, zone);
  const hit = ids.find((id) => nameOf(game, id) === name);
  if (!hit) throw new Error(`${player} has no "${name}" in ${zone} (has: ${ids.map((i) => nameOf(game, i)).join(', ')})`);
  return hit;
}

export function findAnywhere(game: Game, player: PlayerId, name: string): InstanceId {
  for (const zone of ['library', 'hand', 'graveyard', 'exile', 'command'] as const) {
    const hit = idsIn(game, player, zone).find((id) => nameOf(game, id) === name);
    if (hit) return hit;
  }
  const bf = battlefieldOf(game, player).find((id) => nameOf(game, id) === name);
  if (bf) return bf;
  throw new Error(`${player} has no "${name}" anywhere`);
}

/**
 * Put a card from a player's library onto the battlefield (or anywhere else).
 *
 * ⚠️ Goes through the real `ManualMoveCard` intent, so the board a test asserts
 * on is one the engine could genuinely produce, and the whole scenario replays.
 */
export function put(
  game: Game,
  player: PlayerId,
  name: string,
  to: 'battlefield' | 'hand' | 'graveyard' | 'exile' | 'command' = 'battlefield',
): InstanceId {
  // Library first, then hand: a named card is usually still in the deck, but
  // the opening seven takes 7 of ~30, so it lands in hand often enough that
  // "no such card in library" was the harness's most common false failure.
  const card = findAnywhere(game, player, name);
  must(
    game.submit({
      t: 'ManualMoveCard',
      player,
      card,
      to: { kind: to, player },
    }),
  );
  return card;
}

/**
 * Turn OFF auto-pass for a player, so a test can take two actions in a row.
 *
 * Without this the engine correctly auto-passes for them the moment their only
 * remaining action is a pass, and the second intent arrives in the next step —
 * which reads as "the handler rejected it for the wrong reason".
 */
export function fullControl(game: Game, player: PlayerId): void {
  const stops = game.state.players[player]?.stops;
  if (!stops) throw new Error(`no such player ${player}`);
  must(game.submit({ t: 'SetStops', player, stops: { ...stops, mode: 'fullControl' } }));
}

/**
 * Stop the engine at every priority round, for every seat.
 *
 * ⚠️ A test that needs to OBSERVE an intermediate state — a spell sitting on the
 * stack, a creature still in combat, the board between blocks and damage — has
 * to say so. Auto-pass is a policy (`legal.ts`), and it deliberately runs the
 * game past any window in which nobody could act: a scenario that leant on the
 * default stops to hold the engine still was really asserting the policy of the
 * day, and it broke the moment the policy got better at its job. Full control is
 * the documented "stop everywhere", and saying it out loud keeps a RULES test
 * about the rules.
 */
export function holdEverywhere(game: Game): void {
  for (const id of game.state.seating) fullControl(game, id);
}

/** Untap and clear summoning sickness the honest way: it is a new turn. */
export function clearSickness(game: Game): void {
  const start = game.state.turn.turnNumber;
  advanceUntil(game, (s) => s.turn.turnNumber > start);
}

/**
 * Drive the game forward by passing priority (and answering prompts with the
 * simplest legal answer) until `done` holds.
 *
 * Exercises the real loop rather than reaching into state, which means a test
 * that says "get to the declare-blockers step" fails loudly if the loop cannot
 * actually get there.
 */
export function advanceUntil(
  game: Game,
  done: (state: GameState) => boolean,
  maxSteps = 4000,
): void {
  for (let i = 0; i < maxSteps; i++) {
    if (done(game.state)) return;
    if (game.state.gamePhase === 'finished') return;
    const awaiting = game.state.priority.awaiting;
    if (awaiting) {
      answer(game, awaiting);
      continue;
    }
    const holder = game.state.priority.player;
    if (holder === null) throw new Error('advanceUntil: nobody has priority and nothing is awaited');
    const result = game.submit({ t: 'PassPriority', player: holder });
    if (!result.ok) throw new Error(`advanceUntil: ${result.message}`);
  }
  throw new Error(
    `advanceUntil: gave up after ${maxSteps} steps at turn ${game.state.turn.turnNumber} ${game.state.turn.step}`,
  );
}

export function advanceToStep(game: Game, step: Step, turn?: number): void {
  advanceUntil(
    game,
    (s) => s.turn.step === step && (turn === undefined || s.turn.turnNumber === turn),
  );
}

/**
 * The simplest legal answer to any prompt: decline, keep, attack with nothing.
 *
 * ⚠️ There is no `no simple answer` branch any more — `simplestAnswer` returns an
 * `Intent`, never null, so the only way this throws is a REJECTION, and that
 * carries the handler's own message about what was wrong with the answer.
 */
export function answer(game: Game, awaiting: NonNullable<GameState['priority']['awaiting']>): void {
  const result = game.submit(simplestAnswer(awaiting, game.state));
  if (!result.ok) throw new Error(`answering ${awaiting.kind}: ${result.message}`);
}

/**
 * @param game needed only by `chooseTargets`, which has to pick a target that is
 *   actually legal — an empty list stopped being an acceptable answer the moment
 *   a clause could carry `min > 0`.
 */
/**
 * The minimum legal declaration for a targets prompt, or null when the board
 * offers none.
 *
 * ⚠️ Uses the SAME predicate the host validates with, and now the same FILL:
 * `minimumLegalTargets` is what the engine asks before it lets a targeted
 * trigger onto the stack (CR 603.3d). A second opinion here would make the
 * fuzzer green while real play rejected the same pick.
 */
function pickLegalTargets(
  state: GameState,
  awaiting: Extract<NonNullable<GameState['priority']['awaiting']>, { kind: 'chooseTargets' }>,
): TargetChoice[] | null {
  const src = sourceOf(state, awaiting);
  if (!src) return null;
  return minimumLegalTargets(awaiting.specs, src, candidatesFromState(state, deps()));
}

function sourceOf(
  state: GameState,
  awaiting: Extract<NonNullable<GameState['priority']['awaiting']>, { kind: 'chooseTargets' }>,
): TargetingSource | null {
  const card = state.cards[awaiting.source];
  if (!card) return null;
  const oracleCard = ORACLE.byPrinting(card.printingId);
  if (!oracleCard) return null;
  return { controller: awaiting.player, colors: faceOf(oracleCard, card.faceIndex).colors };
}

/** An instance id no card can have, so the handler rejects it BY NAME. */
const NO_SUCH_ID = '<no-such-card>';

/**
 * The first of `preferred`, else of any fallback list, else any seat at all.
 *
 * ⚠️ Only ever reached by a MALFORMED prompt, and it exists so that case answers
 * rather than shrugging. `state.seating` is non-empty for any real game; the
 * final `?? NO_SUCH_ID` is there so this returns a `PlayerId` unconditionally,
 * and an id no seat has is rejected by name.
 */
function firstSeat(
  preferred: readonly PlayerId[],
  state: GameState,
  ...fallbacks: readonly (readonly PlayerId[])[]
): PlayerId {
  for (const list of [preferred, ...fallbacks, state.seating]) {
    const hit = list[0];
    if (hit !== undefined) return hit;
  }
  return NO_SUCH_ID;
}

/**
 * ⚠️ RETURNS AN `Intent`, NOT `Intent | null`, AND THAT IS THE GUARD. This
 * returned null for four kinds outright and through three `x ? … : null`
 * ternaries — and a driver that returns null submits nothing ever again, with a
 * wedged game looking exactly like a healthy idle one (D102). Every case answers
 * now, so "the driver always has an answer" is a fact about the TYPE rather than
 * about the current set of branches: a case added later that cannot think of an
 * answer fails `tsc -b` instead of silently reintroducing the wedge.
 *
 * ⚠️ AN ANSWER MAY STILL BE REJECTED, and that is the point of preferring one to
 * null. The three ternaries guarded prompts their producers make impossible —
 * an empty mulligan list, a fully-submitted block declaration, a legend choice
 * with no candidates. For those, a rejection carries the HANDLER's message and
 * names the disagreement; `no simple answer for prompt "mulligan"` named nothing
 * and pointed at this file rather than at the malformed prompt.
 *
 * ⚠️ `state` IS REQUIRED, and it used to be optional "so old call sites still
 * compile". Its own comment then had to warn that a caller who omitted it
 * CANCELS every cast that asks for a target — the fuzzer's targeting canaries
 * exist because that is exactly what happened the first time: 6,070 prompts, 0
 * targets declared, every other assertion green. An argument whose absence
 * silently degrades every answer is not optional, it is a trap; both real
 * callers passed it already, so requiring it costs nothing and makes the next
 * omission a compile error. Four answers below need it outright.
 */
export function simplestAnswer(
  awaiting: NonNullable<GameState['priority']['awaiting']>,
  state: GameState,
): Intent {
  switch (awaiting.kind) {
    /**
     * ⚠️ WHITE, ALWAYS, and deliberately arbitrary: any of the five is legal on
     * any board, so there is no "simplest" here in the sense every other case
     * means. A fixed answer is what keeps the fuzzer's games reproducible.
     */
    /**
     * ⚠️ The FIRST option — battlefield order, which is what the engine did for
     * everyone before D148 and is deterministic, so the fuzzer's games stay
     * reproducible.
     */
    case 'chooseReplacement':
      return {
        t: 'AnswerChooseReplacement',
        player: awaiting.player,
        key: awaiting.options[0]?.key ?? '<none>',
      };
    case 'chooseColor':
      return { t: 'AnswerChooseColor', player: awaiting.player, color: 'W' };

    /**
     * ⚠️ `players` is never empty while this prompt is up — `advanceMulligan`
     * returns early through `mulligansComplete` once nobody is pending — so the
     * fallback is for a MALFORMED prompt alone. It still answers, because a
     * rejection carries the handler's own message and NAMES the disagreement,
     * where a null said only "no simple answer" and named nothing.
     */
    case 'mulligan':
      return { t: 'MulliganDecision', player: firstSeat(awaiting.players, state), keep: true };
    /**
     * ⚠️ Returned `null` until D125, which is D102's exact shape: `answer()`
     * throws on it and the fuzzer's `default:` branch would submit nothing ever
     * again. Reachable the moment anyone mulligans — `loop.ts` raises this
     * whenever a kept hand owes cards — so it was a live wedge, not a
     * theoretical one, and only the fuzzer having its OWN randomised case for
     * this kind kept the gate off it.
     *
     * The first `count` in hand order. The handler wants exactly `count` cards,
     * all of them in hand; `slice` is the one form that cannot name a card
     * twice, which `includes` alone would not catch.
     */
    case 'mulliganBottom': {
      const hand = state.zones.hand[awaiting.player] ?? [];
      return {
        t: 'MulliganBottom',
        player: awaiting.player,
        cards: hand.slice(0, awaiting.count),
      };
    }
    case 'declareAttackers':
      return { t: 'DeclareAttackers', player: awaiting.player, attackers: [] };
    case 'chooseX':
      return { t: 'ChooseX', player: awaiting.player, x: 0 };
    /**
     * ⚠️ Someone always still owes a declaration while this is up: the handler
     * emits `AwaitingSet null` the moment the LAST player submits. If every seat
     * has somehow submitted, naming one anyway is rejected `alreadySubmitted`,
     * which says exactly that.
     */
    case 'declareBlockers': {
      const pending = awaiting.players.filter((p) => !awaiting.submitted.includes(p));
      return { t: 'DeclareBlockers', player: firstSeat(pending, state, awaiting.players), blocks: [] };
    }
    /**
     * ⚠️ THE STATE'S OWN ORDER, VERBATIM. Both handlers check
     * `sameSet(decl.…Order, intent.order)` — exactly these creatures, no more and
     * no fewer — so the existing order is the one answer that is always accepted,
     * and re-deriving the membership here would be a second opinion about what is
     * blocking what. Identity is a legal permutation.
     *
     * Neither has a producer (`awaitingProducers.node.test.ts` pins that), so
     * these are unreachable today — which is precisely why they returned `null`
     * for three milestones without anyone noticing. A missing `decl` submits and
     * is REJECTED, and a rejection names the disagreement; `null` throws
     * "no simple answer" and names nothing.
     */
    case 'orderBlockers': {
      const decl = state.combat?.attackers.find((a) => a.card === awaiting.attacker);
      return {
        t: 'OrderBlockers',
        player: awaiting.player,
        attacker: awaiting.attacker,
        order: [...(decl?.blockerOrder ?? [])],
      };
    }
    case 'orderAttackers': {
      const decl = state.combat?.blockers.find((b) => b.card === awaiting.blocker);
      return {
        t: 'OrderAttackers',
        player: awaiting.player,
        blocker: awaiting.blocker,
        order: [...(decl?.attackerOrder ?? [])],
      };
    }
    case 'orderTriggers':
      return { t: 'OrderTriggers', player: awaiting.player, order: [...awaiting.triggers] };
    /**
     * ⚠️ DECLINE, which is this function's stated policy ("decline, keep, attack
     * with nothing") and, here, the answer that cannot fail: it runs no script,
     * so it is legal whatever the board underneath has become. Accepting would
     * make every `advanceUntil` in the suite silently execute card text a test
     * did not ask for.
     *
     * ⚠️ Which is exactly why the FUZZ GATE carries its own randomised case for
     * this kind rather than falling through to here — a driver that only ever
     * declines never reaches the half of the primitive that runs anything, and
     * a canary over a path nothing takes is the rot D102 names.
     */
    case 'optionalTrigger':
      return {
        t: 'AnswerOptionalTrigger',
        player: awaiting.player,
        stackId: awaiting.stackId,
        accept: false,
      };
    /**
     * ⚠️ DECLINE, for the reason above and one more that is specific to this
     * prompt: paying is the only answer that can be REJECTED. `answerEntersChoice`
     * re-checks the life total, so a driver that always paid would wedge the
     * moment a test set a player low — and declining costs nothing but a tapped
     * land, which is the state the card describes when nobody pays.
     *
     * ⚠️ And, again, the FUZZ GATE carries its own coin flip for this kind rather
     * than falling through here: 500 seeds of "never pay" would leave the
     * payment half of D136 unexercised while every counter read green.
     */
    case 'entersChoice':
      return {
        t: 'AnswerEntersChoice',
        player: awaiting.player,
        source: awaiting.source,
        pay: false,
      };
    /**
     * ⚠️ THE FIRST ANSWER HERE THAT HAS TO READ THE BOARD, because the prompt
     * ships no candidates (D137) — a hand is hidden and listing it in an
     * `Awaiting` would post it to every client. So the driver does what a client
     * does: takes the cards out of the state itself.
     *
     * ⚠️ It takes the FIRST `count`, deterministically, rather than a "worst"
     * card. `simplestAnswer`'s whole job is an answer that always exists and is
     * always legal, and a heuristic here would make every `advanceUntil` in the
     * suite depend on an evaluation nobody asked it to make. The FUZZ GATE
     * carries its own randomised case, for `optionalTrigger`'s reason.
     *
     * ⚠️ A short hand still answers with what there is. The engine only raises
     * this prompt when the hand is BIGGER than the count, so `slice` cannot come
     * up short — but answering with fewer would be rejected rather than wedging,
     * and being rejected is the outcome this function exists to avoid.
     */
    /**
     * ⚠️ THE REVEALED SET, IN THE ORDER IT ALREADY SITS IN — deterministic, and
     * the only answer that always exists. A "best" ordering would be an
     * evaluation no test asked this driver to make; the FUZZ GATE shuffles
     * instead, so the half of the primitive that reorders anything is actually
     * exercised (D128's lesson, third time).
     */
    case 'orderCards': {
      const shown = (state.zones.library[awaiting.player] ?? []).filter((id) =>
        state.cards[id]?.revealedTo.includes(awaiting.player),
      );
      return { t: 'AnswerOrderCards', player: awaiting.player, cards: shown };
    }
    /**
     * D195 — keep everything on top in the revealed order: the no-op scry,
     * legal from any state, executing no hidden choice a rules test did not
     * ask for (the same reasoning as declining an optional trigger). The
     * revealed run reads top-first when reversed — library top is the END of
     * the array.
     */
    case 'scryChoice': {
      const shown = (state.zones.library[awaiting.player] ?? []).filter((id) =>
        state.cards[id]?.revealedTo.includes(awaiting.player),
      );
      return {
        t: 'AnswerScry',
        player: awaiting.player,
        toTop: [...shown].reverse(),
        toBottom: [],
      };
    }
    case 'chooseFromZone': {
      // ⚠️ TWO ZONES NOW (D141). A hand is read straight off the state; a
      // library offers only the cards the effect just REVEALED, and answering
      // with any other library card is rejected — rightly, since a client could
      // not have seen it.
      const pool =
        awaiting.zone === 'library'
          ? (state.zones.library[awaiting.player] ?? []).filter((id) =>
              state.cards[id]?.revealedTo.includes(awaiting.player),
            )
          : (state.zones.hand[awaiting.player] ?? []);
      return {
        t: 'AnswerChooseFromZone',
        player: awaiting.player,
        cards: pool.slice(0, awaiting.count),
      };
    }
    /**
     * ⚠️ `findLegendChoice` skips any group with fewer than two copies, so
     * `candidates` always holds at least two. An empty one answers with an id no
     * card has, and the handler rejects it `noSuchCard` — "That is not one of the
     * copies you control", which is the truth about a prompt listing none.
     */
    case 'chooseLegendKeep':
      return {
        t: 'ChooseLegendKeep',
        player: awaiting.player,
        keep: awaiting.candidates[0] ?? NO_SUCH_ID,
      };
    case 'commanderZoneChoice':
      return { t: 'CommanderZoneChoice', player: awaiting.player, toCommandZone: true, always: false };
    // ⚠️ `targets: []` used to be the answer here and stopped being legal the
    // moment a clause could carry `min > 0` — `answer()` throws on a rejection,
    // so the 500-seed fuzz gate would have died on the first targeted spell.
    // Pick the minimum a real player would, and fall back to cancelling, which
    // is always available and is the only way off a board where nothing is
    // legal.
    case 'chooseTargets': {
      const picked = pickLegalTargets(state, awaiting);
      return picked
        ? { t: 'ChooseTargets', player: awaiting.player, targets: picked }
        : { t: 'CancelPendingCast', player: awaiting.player };
    }
    /**
     * ⚠️ DECLINE, which is what this function's own header promises ("decline,
     * keep, attack with nothing") and, more importantly, the answer that
     * TERMINATES: one `agree: false` cancels the vote outright, at any table
     * size, because `voteRewind` short-circuits on the first decline.
     *
     * ⚠️ AGREEING WOULD HALF-EXECUTE A REWIND. Unanimity clears the awaiting and
     * nothing else — the actual re-fold is `Game.rewind`, deliberately NOT a
     * reducer case, so it can only be done by the CALLER. A single-`Intent`
     * answerer that agreed would leave the prompt answered, the vote passed and
     * the log never rewound: a game that quietly disagrees with what it just
     * decided. Declining asks nothing of the caller.
     *
     * The proposer is auto-agreed at proposal, so the voter is the first LIVING
     * seat that has not voted. One must exist while the prompt is up — the
     * handler resolves the moment the last living seat votes — and if somehow
     * none does, `CancelRewind` ends it from any seat with no preconditions at
     * all. Prevention and recovery, never one alone (D102).
     */
    case 'rewindVote': {
      const living = state.seating.filter((id) => !(state.players[id]?.hasLost ?? true));
      const voter = living.find(
        (id) => !awaiting.agreed.includes(id) && !awaiting.declined.includes(id),
      );
      return voter
        ? { t: 'VoteRewind', player: voter, agree: false }
        : { t: 'CancelRewind', player: awaiting.proposer };
    }
  }
}
