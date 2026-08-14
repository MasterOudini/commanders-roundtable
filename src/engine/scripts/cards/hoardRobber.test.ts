// `Hoard Robber` — connecting with a player makes a Treasure, through a real
// declared attack.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { HOARD_ROBBER_SCRIPT } from './hoardRobber';
import { advanceUntil, battlefieldOf, must, nameOf, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

const ROBBER = 'Hoard Robber';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function fought(): Game {
  const g = startedGame({
    players: 2,
    decks: [[ROBBER], []],
    scripts: createRegistry([HOARD_ROBBER_SCRIPT]),
  });
  const robber = put(g, 'p1', ROBBER);
  settle(g);
  advanceUntil(
    g,
    (s) => s.turn.turnNumber === 3 && s.priority.awaiting?.kind === 'declareAttackers',
    20_000,
  );
  must(
    g.submit({
      t: 'DeclareAttackers',
      player: 'p1',
      attackers: [{ card: robber, defender: { kind: 'player', id: 'p2' } }],
    }),
  );
  settle(g);
  return g;
}

describe('Hoard Robber', () => {
  test('combat damage to a player creates a Treasure', () => {
    const g = fought();
    expect(g.state.players['p2']?.life).toBe(39);
    expect(battlefieldOf(g, 'p1').filter((id) => nameOf(g, id) === 'Treasure')).toHaveLength(1);
  });

  test('replays to the same hash', () => {
    const g = fought();
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
