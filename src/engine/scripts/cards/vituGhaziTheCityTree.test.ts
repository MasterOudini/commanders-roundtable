// `Vitu-Ghazi, the City-Tree` — the Saproling is ability ONE: the mana line
// above it counts.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { VITU_GHAZI_THE_CITY_TREE_SCRIPT } from './vituGhaziTheCityTree';
import { advanceUntil, battlefieldOf, must, nameOf, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const LAND = 'Vitu-Ghazi, the City-Tree';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function saprolings(g: Game): InstanceId[] {
  return battlefieldOf(g, 'p1').filter((id) => nameOf(g, id) === 'Saproling');
}

function board(): { g: Game; land: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [[LAND], []],
    scripts: createRegistry([VITU_GHAZI_THE_CITY_TREE_SCRIPT]),
  });
  const land = put(g, 'p1', LAND);
  settle(g);
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 4 }));
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'G', amount: 2 }));
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'W', amount: 2 }));
  return { g, land };
}

describe('Vitu-Ghazi, the City-Tree', () => {
  test('the activation taps the land and makes one Saproling', () => {
    const { g, land } = board();
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: land, abilityIndex: 1, targets: [] }));
    settle(g);
    expect(g.state.cards[land]?.tapped).toBe(true);
    expect(saprolings(g)).toHaveLength(1);
  });

  test('the {T} is in the cost, so it does not go twice in one turn', () => {
    const { g, land } = board();
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: land, abilityIndex: 1, targets: [] }));
    settle(g);
    const again = g.submit({
      t: 'ActivateAbility',
      player: 'p1',
      card: land,
      abilityIndex: 1,
      targets: [],
    });
    expect(again.ok).toBe(false);
    expect(saprolings(g)).toHaveLength(1);
  });

  test('replays to the same hash', () => {
    const { g, land } = board();
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: land, abilityIndex: 1, targets: [] }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
