// `Season of Growth` — a creature of mine entering asks a scry 1; a spell
// of mine aimed at a creature I control draws, one aimed at theirs does not.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { SEASON_OF_GROWTH_SCRIPT } from './seasonOfGrowth';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const SEASON = 'Season of Growth';
const BEARS = 'Grizzly Bears';
const PUMP = 'Might of the Old Ways'; // "Target creature gets +2/+2 …", {1}{G}

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function drawsFor(g: Game, player: string, from: number): number {
  let n = 0;
  for (const e of g.log.slice(from)) {
    if (e.body.t !== 'CardsMoved') continue;
    n += e.body.moves.filter((m) => m.from.kind === 'library' && m.to.kind === 'hand' && m.to.player === player).length;
  }
  return n;
}

function answerScry(g: Game): void {
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'scryChoice', 20_000);
  const lib = g.state.zones.library['p1'] ?? [];
  const revealed = lib.filter((id) => g.state.cards[id]?.revealedTo.includes('p1'));
  must(g.submit({ t: 'AnswerScry', player: 'p1', toTop: [...revealed], toBottom: [] }));
  settle(g);
}

/** Scry asks raised since a log mark — the exact count, however the engine narrates a reveal. */
function scryAsksSince(g: Game, from: number): number {
  // AwaitingSet also CLEARS an ask (awaiting null), so guard before reading its kind.
  return g.log.slice(from).filter((e) => e.body.t === 'AwaitingSet' && e.body.awaiting !== null && e.body.awaiting.kind === 'scryChoice').length;
}

/**
 * Season out; THEIR Bears enters (no ask), then MY Bears enters (the scry
 * asked and answered); p1 in its main with the pump in hand.
 */
function grown(): { g: Game; mine: InstanceId; theirs: InstanceId; theirAsks: number; myAsks: number } {
  const g = startedGame({
    players: 2,
    decks: [[SEASON, BEARS, PUMP], [BEARS]],
    scripts: createRegistry([SEASON_OF_GROWTH_SCRIPT]),
  });
  put(g, 'p1', SEASON);
  settle(g);
  holdEverywhere(g);
  let logAt = g.log.length;
  const theirs = put(g, 'p2', BEARS);
  settle(g);
  const theirAsks = scryAsksSince(g, logAt);
  logAt = g.log.length;
  const mine = put(g, 'p1', BEARS);
  answerScry(g);
  const myAsks = scryAsksSince(g, logAt);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain' && s.priority.awaiting === null, 60_000);
  return { g, mine, theirs, theirAsks, myAsks };
}

function castPumpAt(g: Game, target: InstanceId): number {
  const spell = put(g, 'p1', PUMP, 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'G', amount: 1 }));
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 1 }));
  const logAt = g.log.length;
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
  must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: target }] }));
  settle(g);
  return logAt;
}

describe('Season of Growth', () => {
  test('a creature of mine entering asks a scry 1; the opponent creature asked nothing', () => {
    const { theirAsks, myAsks } = grown();
    expect(theirAsks).toBe(0);
    expect(myAsks).toBe(1);
  });

  test('a spell of mine aimed at my creature draws a card', () => {
    const { g, mine } = grown();
    const logAt = castPumpAt(g, mine);
    expect(drawsFor(g, 'p1', logAt)).toBe(1);
  });

  test("a spell of mine aimed at the opponent's creature draws nothing", () => {
    const { g, theirs } = grown();
    const logAt = castPumpAt(g, theirs);
    expect(drawsFor(g, 'p1', logAt)).toBe(0);
  });

  test('replays to the same hash', () => {
    const { g, mine } = grown();
    castPumpAt(g, mine);
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
