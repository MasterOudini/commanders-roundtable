// `Yavimaya Sapherd` — one Saproling on the way in, mine.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { YAVIMAYA_SAPHERD_SCRIPT } from './yavimayaSapherd';
import { advanceUntil, battlefieldOf, nameOf, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

const SAPHERD = 'Yavimaya Sapherd';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function entered(): Game {
  const g = startedGame({
    players: 2,
    decks: [[SAPHERD], []],
    scripts: createRegistry([YAVIMAYA_SAPHERD_SCRIPT]),
  });
  put(g, 'p1', SAPHERD);
  settle(g);
  return g;
}

describe('Yavimaya Sapherd', () => {
  test('exactly one Saproling, under MY control', () => {
    const g = entered();
    expect(battlefieldOf(g, 'p1').filter((id) => nameOf(g, id) === 'Saproling')).toHaveLength(1);
    expect(battlefieldOf(g, 'p2').filter((id) => nameOf(g, id) === 'Saproling')).toHaveLength(0);
  });

  test('replays to the same hash', () => {
    const g = entered();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
