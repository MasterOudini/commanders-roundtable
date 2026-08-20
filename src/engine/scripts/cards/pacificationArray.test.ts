// `Pacification Array` — taps a creature OR an artifact.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { PACIFICATION_ARRAY_SCRIPT } from './pacificationArray';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function arrayed(): { g: Game; array: InstanceId; ring: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [['Pacification Array'], ['Sol Ring']],
    scripts: createRegistry([PACIFICATION_ARRAY_SCRIPT]),
  });
  const ring = put(g, 'p2', 'Sol Ring');
  const array = put(g, 'p1', 'Pacification Array');
  settle(g);
  advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 2 }));
  return { g, array, ring };
}

describe('Pacification Array', () => {
  test('taps the targeted ARTIFACT — the compound holds both arms', () => {
    const { g, array, ring } = arrayed();
    must(
      g.submit({
        t: 'ActivateAbility',
        player: 'p1',
        card: array,
        abilityIndex: 0,
        targets: [{ kind: 'card', id: ring }],
      }),
    );
    settle(g);
    expect(g.state.cards[ring]?.tapped).toBe(true);
  });

  test('replays to the same hash', () => {
    const { g, array, ring } = arrayed();
    must(
      g.submit({
        t: 'ActivateAbility',
        player: 'p1',
        card: array,
        abilityIndex: 0,
        targets: [{ kind: 'card', id: ring }],
      }),
    );
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
