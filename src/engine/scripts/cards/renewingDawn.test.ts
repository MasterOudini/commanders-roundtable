// `Renewing Dawn` — two of their Mountains pay 4; mine count nothing.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { RENEWING_DAWN_SCRIPT } from './renewingDawn';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function dawned(): Game {
  const g = startedGame({
    players: 2,
    decks: [['Renewing Dawn'], []],
    scripts: createRegistry([RENEWING_DAWN_SCRIPT]),
  });
  put(g, 'p2', 'Mountain');
  put(g, 'p2', 'Mountain');
  put(g, 'p1', 'Mountain');
  settle(g);
  const spell = put(g, 'p1', 'Renewing Dawn', 'hand');
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 20_000);
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'W', amount: 1 }));
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 1 }));
  must(
    g.submit({ t: 'CastSpell', player: 'p1', card: spell, targets: [{ kind: 'player', id: 'p2' }] }),
  );
  settle(g);
  return g;
}

describe('Renewing Dawn', () => {
  test('gains 2 per Mountain the TARGET controls', () => {
    const g = dawned();
    expect(g.state.players['p1']?.life).toBe(44);
  });

  test('replays to the same hash', () => {
    const g = dawned();
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
