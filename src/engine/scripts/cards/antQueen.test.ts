// `Ant Queen` — the first REPEATABLE token ability: two activations, two real
// Insects, no tap anywhere.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { ANT_QUEEN_SCRIPT } from './antQueen';
import { advanceUntil, battlefieldOf, must, nameOf, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

const QUEEN = 'Ant Queen';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

describe('Ant Queen', () => {
  test('two activations make two real Insects, and the Queen never taps', () => {
    const g = startedGame({
      players: 2,
      decks: [[QUEEN], []],
      scripts: createRegistry([ANT_QUEEN_SCRIPT]),
    });
    const queen = put(g, 'p1', QUEEN);
    settle(g);
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'G', amount: 2 }));
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 2 }));
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: queen, abilityIndex: 0 }));
    settle(g);
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: queen, abilityIndex: 0 }));
    settle(g);
    expect(battlefieldOf(g, 'p1').filter((id) => nameOf(g, id) === 'Insect')).toHaveLength(2);
    expect(g.state.cards[queen]?.tapped).toBe(false);
    advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
