// `Goblin Trenches` — the LAND-predicate chooser pays for two DISTINCT
// Goblin Soldiers.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { GOBLIN_TRENCHES_SCRIPT } from './goblinTrenches';
import { advanceUntil, battlefieldOf, must, nameOf, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const TRENCHES = 'Goblin Trenches';
const MOUNTAIN = 'Mountain';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function board(): { g: Game; trenches: InstanceId; mountain: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [[TRENCHES, MOUNTAIN], []],
    scripts: createRegistry([GOBLIN_TRENCHES_SCRIPT]),
  });
  const trenches = put(g, 'p1', TRENCHES);
  const mountain = put(g, 'p1', MOUNTAIN);
  settle(g);
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 2 }));
  return { g, trenches, mountain };
}

describe('Goblin Trenches', () => {
  test('the sacrificed land pays for two DISTINCT Goblin Soldiers', () => {
    const { g, trenches, mountain } = board();
    must(
      g.submit({
        t: 'ActivateAbility',
        player: 'p1',
        card: trenches,
        abilityIndex: 0,
        sacrifice: mountain,
      }),
    );
    settle(g);
    expect(g.state.cards[mountain]?.zone.kind).toBe('graveyard');
    const soldiers = battlefieldOf(g, 'p1').filter((id) => nameOf(g, id) === 'Goblin Soldier');
    expect(soldiers).toHaveLength(2);
    expect(new Set(soldiers).size).toBe(2);
  });

  test('replays to the same hash', () => {
    const { g, trenches, mountain } = board();
    must(
      g.submit({
        t: 'ActivateAbility',
        player: 'p1',
        card: trenches,
        abilityIndex: 0,
        sacrifice: mountain,
      }),
    );
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
