// `Pierce Strider` — the entry takes three from a targeted opponent, and
// its controller is not a legal target.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { PIERCE_STRIDER_SCRIPT } from './pierceStrider';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function pierced(): Game {
  const g = startedGame({
    players: 2,
    decks: [['Pierce Strider'], []],
    scripts: createRegistry([PIERCE_STRIDER_SCRIPT]),
  });
  settle(g);
  holdEverywhere(g);
  put(g, 'p1', 'Pierce Strider');
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 60_000);
  return g;
}

describe('Pierce Strider', () => {
  test('the targeted opponent loses 3; the controller is refused', () => {
    const g = pierced();
    const self = g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'player', id: 'p1' }] });
    expect(self.ok).toBe(false);
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'player', id: 'p2' }] }));
    settle(g);
    expect(g.state.players['p2']?.life).toBe(37);
    expect(g.state.players['p1']?.life).toBe(40);
  });

  test('replays to the same hash', () => {
    const g = pierced();
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'player', id: 'p2' }] }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
