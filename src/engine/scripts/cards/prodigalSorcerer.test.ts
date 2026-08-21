// `Prodigal Sorcerer` — the original Tim, proven on his own id.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { PRODIGAL_SORCERER_SCRIPT } from './prodigalSorcerer';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function ready(): { g: Game; tim: string } {
  const g = startedGame({
    players: 2,
    decks: [['Prodigal Sorcerer'], []],
    scripts: createRegistry([PRODIGAL_SORCERER_SCRIPT]),
  });
  const tim = put(g, 'p1', 'Prodigal Sorcerer');
  settle(g);
  advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
  return { g, tim };
}

describe('Prodigal Sorcerer', () => {
  test('pings a player for exactly one', () => {
    const { g, tim } = ready();
    must(
      g.submit({
        t: 'ActivateAbility',
        player: 'p1',
        card: tim,
        abilityIndex: 0,
        targets: [{ kind: 'player', id: 'p2' }],
      }),
    );
    settle(g);
    expect(g.state.players['p2']?.life).toBe(39);
  });

  test('replays to the same hash', () => {
    const { g, tim } = ready();
    must(
      g.submit({
        t: 'ActivateAbility',
        player: 'p1',
        card: tim,
        abilityIndex: 0,
        targets: [{ kind: 'player', id: 'p2' }],
      }),
    );
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
