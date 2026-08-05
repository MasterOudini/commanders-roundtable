// `Akoum Refuge` — A.I.M. Labs' twin; the composition case lives there.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { AKOUM_REFUGE_SCRIPT } from './akoumRefuge';
import { advanceUntil, put, startedGame } from '../../testing/harness';

const REFUGE = 'Akoum Refuge';

describe('Akoum Refuge', () => {
  test('gains 1 on entry, tapped, and replays', () => {
    const g = startedGame({
      players: 2,
      decks: [[REFUGE], []],
      scripts: createRegistry([AKOUM_REFUGE_SCRIPT]),
    });
    const id = put(g, 'p1', REFUGE);
    advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
    expect(g.state.cards[id]?.tapped).toBe(true);
    expect(g.state.players['p1']?.life).toBe(41);
    advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
