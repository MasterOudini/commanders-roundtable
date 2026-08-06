// `Enatu Golem` — dying pays 4 life.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { ENATU_GOLEM_SCRIPT } from './enatuGolem';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

const GOLEM = 'Enatu Golem';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

describe('Enatu Golem', () => {
  test('dying gains 4 life', () => {
    const g = startedGame({
      players: 2,
      decks: [[GOLEM], []],
      scripts: createRegistry([ENATU_GOLEM_SCRIPT]),
    });
    const golem = put(g, 'p1', GOLEM);
    settle(g);
    const lifeBefore = g.state.players['p1']?.life ?? 0;
    must(
      g.submit({ t: 'ManualMoveCard', player: 'p1', card: golem, to: { kind: 'graveyard', player: 'p1' } }),
    );
    settle(g);
    expect(g.state.players['p1']?.life).toBe(lifeBefore + 4);
  });

  test('replays to the same hash', () => {
    const g = startedGame({
      players: 2,
      decks: [[GOLEM], []],
      scripts: createRegistry([ENATU_GOLEM_SCRIPT]),
    });
    const golem = put(g, 'p1', GOLEM);
    settle(g);
    must(
      g.submit({ t: 'ManualMoveCard', player: 'p1', card: golem, to: { kind: 'graveyard', player: 'p1' } }),
    );
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
