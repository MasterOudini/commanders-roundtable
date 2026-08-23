// `Think Tank` — the upkeep surveil, on MY upkeep only.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { THINK_TANK_SCRIPT } from './thinkTank';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const TANK = 'Think Tank';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function game(): Game {
  const g = startedGame({
    players: 2,
    decks: [[TANK], []],
    scripts: createRegistry([THINK_TANK_SCRIPT]),
  });
  put(g, 'p1', TANK);
  settle(g);
  holdEverywhere(g);
  return g;
}

/** Answers a standing surveil by keeping the card on top. */
function answer(g: Game): void {
  const lib = g.state.zones.library['p1'] ?? [];
  const revealed = lib.filter((id) => g.state.cards[id]?.revealedTo.includes('p1')) as InstanceId[];
  expect(revealed).toHaveLength(1);
  must(g.submit({ t: 'AnswerScry', player: 'p1', toTop: revealed, toBottom: [] }));
  advanceUntil(g, (s) => s.priority.awaiting === null, 20_000);
}

describe('Think Tank', () => {
  test('MY upkeep asks the surveil', () => {
    const g = game();
    advanceUntil(
      g,
      (s) => s.priority.awaiting?.kind === 'scryChoice' && s.turn.activePlayer === 'p1',
      60_000,
    );
    answer(g);
    settle(g);
    expect(g.state.priority.awaiting).toBeNull();
  });

  test("an OPPONENT's upkeep passes silently", () => {
    const g = game();
    // Walk through a full p2 upkeep; nothing may stop on a scry.
    advanceUntil(g, (s) => s.turn.activePlayer === 'p2', 60_000);
    advanceUntil(
      g,
      (s) => s.turn.activePlayer === 'p2' && s.turn.phase === 'precombatMain',
      60_000,
    );
    expect(g.state.priority.awaiting?.kind).not.toBe('scryChoice');
  });

  test('replays to the same hash', () => {
    const g = game();
    advanceUntil(
      g,
      (s) => s.priority.awaiting?.kind === 'scryChoice' && s.turn.activePlayer === 'p1',
      60_000,
    );
    const lib = g.state.zones.library['p1'] ?? [];
    const revealed = lib.filter((id) => g.state.cards[id]?.revealedTo.includes('p1')) as InstanceId[];
    must(g.submit({ t: 'AnswerScry', player: 'p1', toTop: [], toBottom: revealed }));
    settle(g);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
