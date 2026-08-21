// `Pyroclastic Elemental` — a paid point at a player, twice in one turn.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { PYROCLASTIC_ELEMENTAL_SCRIPT } from './pyroclasticElemental';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function erupted(): { g: Game; elemental: string } {
  const g = startedGame({
    players: 2,
    decks: [['Pyroclastic Elemental'], []],
    scripts: createRegistry([PYROCLASTIC_ELEMENTAL_SCRIPT]),
  });
  const elemental = put(g, 'p1', 'Pyroclastic Elemental');
  settle(g);
  advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
  return { g, elemental };
}

describe('Pyroclastic Elemental', () => {
  test('two activations in one turn take 2', () => {
    const { g, elemental } = erupted();
    for (let i = 0; i < 2; i++) {
      must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'R', amount: 2 }));
      must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 1 }));
      must(
        g.submit({
          t: 'ActivateAbility',
          player: 'p1',
          card: elemental,
          abilityIndex: 0,
          targets: [{ kind: 'player', id: 'p2' }],
        }),
      );
      settle(g);
    }
    expect(g.state.players['p2']?.life).toBe(38);
  });

  test('replays to the same hash', () => {
    const { g, elemental } = erupted();
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'R', amount: 2 }));
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 1 }));
    must(
      g.submit({
        t: 'ActivateAbility',
        player: 'p1',
        card: elemental,
        abilityIndex: 0,
        targets: [{ kind: 'player', id: 'p2' }],
      }),
    );
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
