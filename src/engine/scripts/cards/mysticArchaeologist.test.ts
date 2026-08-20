// `Mystic Archaeologist` — {3}{U}{U} draws two, no tap, twice a turn if
// paid.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { MYSTIC_ARCHAEOLOGIST_SCRIPT } from './mysticArchaeologist';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function dug(): { g: Game; arch: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [['Mystic Archaeologist'], []],
    scripts: createRegistry([MYSTIC_ARCHAEOLOGIST_SCRIPT]),
  });
  const arch = put(g, 'p1', 'Mystic Archaeologist');
  settle(g);
  advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 3 }));
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'U', amount: 2 }));
  return { g, arch };
}

describe('Mystic Archaeologist', () => {
  test('draws two', () => {
    const { g, arch } = dug();
    const mid = (g.state.zones.hand['p1'] ?? []).length;
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: arch, abilityIndex: 0 }));
    settle(g);
    expect((g.state.zones.hand['p1'] ?? []).length).toBe(mid + 2);
    expect(g.state.cards[arch]?.tapped).toBe(false);
  });

  test('replays to the same hash', () => {
    const { g, arch } = dug();
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: arch, abilityIndex: 0 }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
