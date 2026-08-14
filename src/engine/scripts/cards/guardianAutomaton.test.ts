// `Guardian Automaton` — dying pays 3 life.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { GUARDIAN_AUTOMATON_SCRIPT } from './guardianAutomaton';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

const AUTOMATON = 'Guardian Automaton';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function died(): Game {
  const g = startedGame({
    players: 2,
    decks: [[AUTOMATON], []],
    scripts: createRegistry([GUARDIAN_AUTOMATON_SCRIPT]),
  });
  const automaton = put(g, 'p1', AUTOMATON);
  settle(g);
  must(g.submit({ t: 'ManualMoveCard', player: 'p1', card: automaton, to: { kind: 'graveyard', player: 'p1' } }));
  settle(g);
  return g;
}

describe('Guardian Automaton', () => {
  test('dying gains its controller 3 life', () => {
    const g = died();
    expect(g.state.players.p1?.life).toBe(43);
  });

  test('replays to the same hash', () => {
    const g = died();
    advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
