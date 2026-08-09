// `Filigree Crawler` — dying leaves a Thopter behind.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { FILIGREE_CRAWLER_SCRIPT } from './filigreeCrawler';
import { advanceUntil, battlefieldOf, must, nameOf, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

const CRAWLER = 'Filigree Crawler';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

describe('Filigree Crawler', () => {
  test('dying creates the 1/1 Thopter', () => {
    const g = startedGame({
      players: 2,
      decks: [[CRAWLER], []],
      scripts: createRegistry([FILIGREE_CRAWLER_SCRIPT]),
    });
    const crawler = put(g, 'p1', CRAWLER);
    settle(g);
    must(
      g.submit({ t: 'ManualMoveCard', player: 'p1', card: crawler, to: { kind: 'graveyard', player: 'p1' } }),
    );
    settle(g);
    expect(battlefieldOf(g, 'p1').filter((id) => nameOf(g, id) === 'Thopter')).toHaveLength(1);
  });

  test('replays to the same hash', () => {
    const g = startedGame({
      players: 2,
      decks: [[CRAWLER], []],
      scripts: createRegistry([FILIGREE_CRAWLER_SCRIPT]),
    });
    const crawler = put(g, 'p1', CRAWLER);
    settle(g);
    must(
      g.submit({ t: 'ManualMoveCard', player: 'p1', card: crawler, to: { kind: 'graveyard', player: 'p1' } }),
    );
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
