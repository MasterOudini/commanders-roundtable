// `Centaur Glade` — the enchantment's repeatable Centaur.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { CENTAUR_GLADE_SCRIPT } from './centaurGlade';
import { advanceUntil, battlefieldOf, must, nameOf, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const GLADE = 'Centaur Glade';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function game(): { g: Game; glade: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [[GLADE], []],
    scripts: createRegistry([CENTAUR_GLADE_SCRIPT]),
  });
  const glade = put(g, 'p1', GLADE);
  settle(g);
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'G', amount: 2 }));
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 2 }));
  return { g, glade };
}

describe('Centaur Glade', () => {
  test('creates a real 3/3 Centaur', () => {
    const { g, glade } = game();
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: glade, abilityIndex: 0, targets: [] }));
    settle(g);
    expect(battlefieldOf(g, 'p1').filter((id) => nameOf(g, id) === 'Centaur')).toHaveLength(1);
  });

  test('replays to the same hash', () => {
    const { g, glade } = game();
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: glade, abilityIndex: 0, targets: [] }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
