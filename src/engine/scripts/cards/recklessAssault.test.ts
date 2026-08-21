// `Reckless Assault` — mana and blood buy a point, twice in a turn.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { RECKLESS_ASSAULT_SCRIPT } from './recklessAssault';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function assaulted(): { g: Game; enchantment: string } {
  const g = startedGame({
    players: 2,
    decks: [['Reckless Assault'], []],
    scripts: createRegistry([RECKLESS_ASSAULT_SCRIPT]),
  });
  const enchantment = put(g, 'p1', 'Reckless Assault');
  settle(g);
  advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
  return { g, enchantment };
}

describe('Reckless Assault', () => {
  test('two activations cost 4 life and deal 2', () => {
    const { g, enchantment } = assaulted();
    for (let i = 0; i < 2; i++) {
      must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 1 }));
      must(
        g.submit({
          t: 'ActivateAbility',
          player: 'p1',
          card: enchantment,
          abilityIndex: 0,
          targets: [{ kind: 'player', id: 'p2' }],
        }),
      );
      settle(g);
    }
    expect(g.state.players['p2']?.life).toBe(38);
    expect(g.state.players['p1']?.life).toBe(36);
  });

  test('replays to the same hash', () => {
    const { g, enchantment } = assaulted();
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 1 }));
    must(
      g.submit({
        t: 'ActivateAbility',
        player: 'p1',
        card: enchantment,
        abilityIndex: 0,
        targets: [{ kind: 'player', id: 'p2' }],
      }),
    );
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
