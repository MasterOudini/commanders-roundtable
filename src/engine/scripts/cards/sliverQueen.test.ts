// `Sliver Queen` — two activations, two DISTINCT Slivers in one turn.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { SLIVER_QUEEN_SCRIPT } from './sliverQueen';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function queened(): Game {
  const g = startedGame({
    players: 2,
    decks: [['Sliver Queen'], []],
    scripts: createRegistry([SLIVER_QUEEN_SCRIPT]),
  });
  const queen = put(g, 'p1', 'Sliver Queen');
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'W', amount: 4 }));
  must(g.submit({ t: 'ActivateAbility', player: 'p1', card: queen, abilityIndex: 0 }));
  settle(g);
  must(g.submit({ t: 'ActivateAbility', player: 'p1', card: queen, abilityIndex: 0 }));
  settle(g);
  return g;
}

describe('Sliver Queen', () => {
  test('two activations make two distinct Slivers', () => {
    const g = queened();
    const tokens = (g.state.zones.battlefield ?? []).filter((id) => g.state.cards[id]?.isToken);
    expect(tokens).toHaveLength(2);
    expect(new Set(tokens).size).toBe(2);
  });

  test('replays to the same hash', () => {
    const g = queened();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
