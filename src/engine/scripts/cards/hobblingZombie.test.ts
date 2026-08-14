// `Hobbling Zombie` — dying leaves a decayed 2/2 Zombie behind.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { HOBBLING_ZOMBIE_SCRIPT } from './hobblingZombie';
import { advanceUntil, battlefieldOf, must, nameOf, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

const HOBBLER = 'Hobbling Zombie';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function died(): Game {
  const g = startedGame({
    players: 2,
    decks: [[HOBBLER], []],
    scripts: createRegistry([HOBBLING_ZOMBIE_SCRIPT]),
  });
  const hobbler = put(g, 'p1', HOBBLER);
  settle(g);
  must(
    g.submit({
      t: 'ManualMoveCard',
      player: 'p1',
      card: hobbler,
      to: { kind: 'graveyard', player: 'p1' },
    }),
  );
  settle(g);
  return g;
}

describe('Hobbling Zombie', () => {
  test('dying creates the decayed Zombie token', () => {
    const g = died();
    const zombies = battlefieldOf(g, 'p1').filter(
      (id) => nameOf(g, id) === 'Zombie' && g.state.cards[id]?.isToken,
    );
    expect(zombies).toHaveLength(1);
  });

  test('replays to the same hash', () => {
    const g = died();
    advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
