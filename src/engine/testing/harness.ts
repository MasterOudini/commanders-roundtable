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
import { EMPTY_REGISTRY, type ScriptRegistry } from '../scripts/registry';
import { ENGINE_CARDS } from '../../data/fixtures/engineCards';
import type { CardData } from '../../data/cardTypes';
import type { EngineDeps } from '../loop';
import type { SetupPlayer, SetupSpec } from '../setup';
import type { InstanceId, PlayerId } from '../types/ids';
import type { Intent } from '../types/intents';
import type { GameOptions, GameState, Step, TargetChoice } from '../types/state';
import type { OracleDb } from '../types/oracle';
import { candidatesFromState, legalTargetsFor, type TargetingSource } from '../targets';
import { faceOf } from '../oracle';

export const ORACLE: OracleDb = ingestOracle(ENGINE_CARDS).db;

export function deps(scripts: ScriptRegistry = EMPTY_REGISTRY): EngineDeps {
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

/** The simplest legal answer to any prompt: decline, keep, attack with nothing. */
export function answer(game: Game, awaiting: NonNullable<GameState['priority']['awaiting']>): void {
  const intent = simplestAnswer(awaiting, game.state);
  if (!intent) throw new Error(`no simple answer for prompt "${awaiting.kind}"`);
  const result = game.submit(intent);
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
 * ⚠️ Uses the SAME predicate the host validates with. A second opinion here
 * would make the fuzzer green while real play rejected the same pick.
 */
function pickLegalTargets(
  state: GameState,
  awaiting: Extract<NonNullable<GameState['priority']['awaiting']>, { kind: 'chooseTargets' }>,
): TargetChoice[] | null {
  const src = sourceOf(state, awaiting);
  if (!src) return null;
  const candidates = candidatesFromState(state, deps());
  const picked: TargetChoice[] = [];
  for (const spec of awaiting.specs) {
    for (let i = 0; i < spec.min; i++) {
      const next = legalTargetsFor(spec, src, candidates).find(
        (c) => !picked.some((p) => p.kind === c.kind && p.id === c.id),
      );
      if (!next) return null;
      picked.push(next);
    }
  }
  return picked;
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

/**
 * ⚠️ `state` is needed only by `chooseTargets`, which has to pick a target that
 * is actually legal — an empty list stopped being an acceptable answer the
 * moment a clause could carry `min > 0`. It is optional so old call sites still
 * compile, but a caller that omits it CANCELS every cast that asks for a target.
 * The fuzzer's targeting canaries exist because that is exactly what happened
 * the first time: 6,070 prompts, 0 targets declared, every other assertion green.
 */
export function simplestAnswer(
  awaiting: NonNullable<GameState['priority']['awaiting']>,
  state?: GameState,
): Intent | null {
  switch (awaiting.kind) {
    case 'mulligan': {
      const player = awaiting.players[0];
      return player ? { t: 'MulliganDecision', player, keep: true } : null;
    }
    case 'mulliganBottom':
      return null;
    case 'declareAttackers':
      return { t: 'DeclareAttackers', player: awaiting.player, attackers: [] };
    case 'chooseX':
      return { t: 'ChooseX', player: awaiting.player, x: 0 };
    case 'declareBlockers': {
      const player = awaiting.players.find((p) => !awaiting.submitted.includes(p));
      return player ? { t: 'DeclareBlockers', player, blocks: [] } : null;
    }
    case 'orderBlockers':
      return null;
    case 'orderAttackers':
      return null;
    case 'orderTriggers':
      return { t: 'OrderTriggers', player: awaiting.player, order: [...awaiting.triggers] };
    case 'chooseLegendKeep': {
      const keep = awaiting.candidates[0];
      return keep ? { t: 'ChooseLegendKeep', player: awaiting.player, keep } : null;
    }
    case 'commanderZoneChoice':
      return { t: 'CommanderZoneChoice', player: awaiting.player, toCommandZone: true, always: false };
    case 'assignCombatDamage':
      return null;
    // ⚠️ `targets: []` used to be the answer here and stopped being legal the
    // moment a clause could carry `min > 0` — `answer()` throws on a rejection,
    // so the 500-seed fuzz gate would have died on the first targeted spell.
    // Pick the minimum a real player would, and fall back to cancelling, which
    // is always available and is the only way off a board where nothing is
    // legal.
    case 'chooseTargets': {
      if (!state) return { t: 'CancelPendingCast', player: awaiting.player };
      const picked = pickLegalTargets(state, awaiting);
      return picked
        ? { t: 'ChooseTargets', player: awaiting.player, targets: picked }
        : { t: 'CancelPendingCast', player: awaiting.player };
    }
    case 'rewindVote':
      return null;
  }
}
