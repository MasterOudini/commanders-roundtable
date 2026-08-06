// `Dragon Roost` — twice the mana, twice the Dragon; the Roost never leaves.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { DRAGON_ROOST_SCRIPT } from './dragonRoost';
import { advanceUntil, battlefieldOf, must, nameOf, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const ROOST = 'Dragon Roost';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function dragons(g: Game): InstanceId[] {
  return battlefieldOf(g, 'p1').filter((id) => nameOf(g, id) === 'Dragon');
}

function game(): { g: Game; roost: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [[ROOST], []],
    scripts: createRegistry([DRAGON_ROOST_SCRIPT]),
  });
  const roost = put(g, 'p1', ROOST);
  settle(g);
  return { g, roost };
}

describe('Dragon Roost', () => {
  test('two activations make two DISTINCT Dragons, no tap anywhere', () => {
    const { g, roost } = game();
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'R', amount: 4 }));
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 10 }));
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: roost, abilityIndex: 0, targets: [] }));
    settle(g);
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: roost, abilityIndex: 0, targets: [] }));
    settle(g);
    const tokens = dragons(g);
    expect(tokens).toHaveLength(2);
    expect(new Set(tokens).size).toBe(2);
    expect(g.state.cards[roost]?.zone.kind).toBe('battlefield');
  });

  test('replays to the same hash', () => {
    const { g, roost } = game();
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'R', amount: 2 }));
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 5 }));
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: roost, abilityIndex: 0, targets: [] }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
