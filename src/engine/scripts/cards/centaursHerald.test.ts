// `Centaur's Herald` — the self-sacrifice Centaur.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { CENTAURS_HERALD_SCRIPT } from './centaursHerald';
import { advanceUntil, battlefieldOf, must, nameOf, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const HERALD = "Centaur's Herald";

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function game(): { g: Game; herald: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [[HERALD], []],
    scripts: createRegistry([CENTAURS_HERALD_SCRIPT]),
  });
  const herald = put(g, 'p1', HERALD);
  settle(g);
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'G', amount: 1 }));
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 2 }));
  return { g, herald };
}

describe("Centaur's Herald", () => {
  test('creates a real 3/3 Centaur with the Herald spent as the cost', () => {
    const { g, herald } = game();
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: herald, abilityIndex: 0, targets: [] }));
    settle(g);
    expect(battlefieldOf(g, 'p1').filter((id) => nameOf(g, id) === 'Centaur')).toHaveLength(1);
    expect(g.state.cards[herald]?.zone.kind).toBe('graveyard');
  });

  test('replays to the same hash', () => {
    const { g, herald } = game();
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: herald, abilityIndex: 0, targets: [] }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
