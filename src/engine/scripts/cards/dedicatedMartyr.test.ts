// `Dedicated Martyr` — the self-sacrifice gain: spent at activation, life on
// resolution.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { DEDICATED_MARTYR_SCRIPT } from './dedicatedMartyr';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const MARTYR = 'Dedicated Martyr';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function game(): { g: Game; martyr: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [[MARTYR], []],
    scripts: createRegistry([DEDICATED_MARTYR_SCRIPT]),
  });
  const martyr = put(g, 'p1', MARTYR);
  settle(g);
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'W', amount: 1 }));
  return { g, martyr };
}

describe('Dedicated Martyr', () => {
  test('spent at activation, and the 3 life arrives on resolution', () => {
    const { g, martyr } = game();
    const lifeBefore = g.state.players['p1']?.life ?? 0;
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: martyr, abilityIndex: 0 }));
    expect(g.state.cards[martyr]?.zone.kind).toBe('graveyard');
    settle(g);
    expect(g.state.players['p1']?.life).toBe(lifeBefore + 3);
  });

  test('replays to the same hash', () => {
    const { g, martyr } = game();
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: martyr, abilityIndex: 0 }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
