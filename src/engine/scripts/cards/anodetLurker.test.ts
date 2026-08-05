// `Anodet Lurker` — dies gain 3; Onulet's deep cases cover the shape.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { ANODET_LURKER_SCRIPT } from './anodetLurker';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';

describe('Anodet Lurker', () => {
  test('dying gains 3 and replays', () => {
    const g = startedGame({
      players: 2,
      decks: [['Anodet Lurker'], []],
      scripts: createRegistry([ANODET_LURKER_SCRIPT]),
    });
    const id = put(g, 'p1', 'Anodet Lurker');
    advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
    must(g.submit({ t: 'ManualMoveCard', player: 'p1', card: id, to: { kind: 'graveyard', player: 'p1' } }));
    advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
    expect(g.state.players['p1']?.life).toBe(43);
    advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
