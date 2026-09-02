// `Youthful Scholar` — its death draws exactly two.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { YOUTHFUL_SCHOLAR_SCRIPT } from './youthfulScholar';
import { advanceUntil, idsIn, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

const SCHOLAR = 'Youthful Scholar';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function died(): { g: Game; before: number } {
  const g = startedGame({
    players: 2,
    decks: [[SCHOLAR], []],
    scripts: createRegistry([YOUTHFUL_SCHOLAR_SCRIPT]),
  });
  const scholar = put(g, 'p1', SCHOLAR);
  settle(g);
  const before = idsIn(g, 'p1', 'hand').length;
  must(g.submit({ t: 'ManualMoveCard', player: 'p1', card: scholar, to: { kind: 'graveyard', player: 'p1' } }));
  settle(g);
  return { g, before };
}

describe('Youthful Scholar', () => {
  test('dying draws two', () => {
    const { g, before } = died();
    expect(idsIn(g, 'p1', 'hand').length).toBe(before + 2);
  });

  test('replays to the same hash', () => {
    const { g } = died();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
