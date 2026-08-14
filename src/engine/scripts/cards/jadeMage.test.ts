// `Jade Mage` — {2}{G} makes a Saproling, twice in one turn (no tap in the
// cost).

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { JADE_MAGE_SCRIPT } from './jadeMage';
import { advanceUntil, battlefieldOf, must, nameOf, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const MAGE = 'Jade Mage';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function board(): { g: Game; mage: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [[MAGE], []],
    scripts: createRegistry([JADE_MAGE_SCRIPT]),
  });
  const mage = put(g, 'p1', MAGE);
  settle(g);
  return { g, mage };
}

function saprolings(g: Game): number {
  return battlefieldOf(g, 'p1').filter((id) => nameOf(g, id) === 'Saproling').length;
}

describe('Jade Mage', () => {
  test('two activations in one turn make two Saprolings', () => {
    const { g, mage } = board();
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 4 }));
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'G', amount: 2 }));
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: mage, abilityIndex: 0 }));
    settle(g);
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: mage, abilityIndex: 0 }));
    settle(g);
    expect(saprolings(g)).toBe(2);
  });

  test('replays to the same hash', () => {
    const { g, mage } = board();
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 2 }));
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'G', amount: 1 }));
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: mage, abilityIndex: 0 }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
