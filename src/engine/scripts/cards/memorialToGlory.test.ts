// `Memorial to Glory` — the sacrifice pays two DISTINCT Soldiers.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { MEMORIAL_TO_GLORY_SCRIPT } from './memorialToGlory';
import { advanceUntil, battlefieldOf, must, nameOf, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const MEMORIAL = 'Memorial to Glory';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function game(): { g: Game; memorial: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [[MEMORIAL], []],
    scripts: createRegistry([MEMORIAL_TO_GLORY_SCRIPT]),
  });
  const memorial = put(g, 'p1', MEMORIAL);
  settle(g);
  must(g.submit({ t: 'ManualSetTapped', player: 'p1', cards: [memorial], tapped: false }));
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 3 }));
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'W', amount: 1 }));
  return { g, memorial };
}

describe('Memorial to Glory', () => {
  test('the sacrifice pays two DISTINCT Soldier tokens', () => {
    const { g, memorial } = game();
    must(
      g.submit({ t: 'ActivateAbility', player: 'p1', card: memorial, abilityIndex: 1, targets: [] }),
    );
    expect(g.state.cards[memorial]?.zone.kind).toBe('graveyard');
    settle(g);
    const soldiers = battlefieldOf(g, 'p1').filter((id) => nameOf(g, id) === 'Soldier');
    expect(soldiers).toHaveLength(2);
    expect(new Set(soldiers).size).toBe(2);
  });

  test('replays to the same hash', () => {
    const { g, memorial } = game();
    must(
      g.submit({ t: 'ActivateAbility', player: 'p1', card: memorial, abilityIndex: 1, targets: [] }),
    );
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
