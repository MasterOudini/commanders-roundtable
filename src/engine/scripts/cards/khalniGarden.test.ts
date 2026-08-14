// `Khalni Garden` — both printed rules on entry: tapped and the Plant.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { KHALNI_GARDEN_SCRIPT } from './khalniGarden';
import { advanceUntil, battlefieldOf, must, nameOf, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const GARDEN = 'Khalni Garden';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function entered(): { g: Game; garden: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [[GARDEN], []],
    scripts: createRegistry([KHALNI_GARDEN_SCRIPT]),
  });
  const garden = put(g, 'p1', GARDEN, 'hand');
  must(g.submit({ t: 'PlayLand', player: 'p1', card: garden }));
  settle(g);
  return { g, garden };
}

describe('Khalni Garden', () => {
  test('enters tapped AND creates the Plant — both printed rules', () => {
    const { g, garden } = entered();
    expect(g.state.cards[garden]?.tapped).toBe(true);
    expect(battlefieldOf(g, 'p1').filter((id) => nameOf(g, id) === 'Plant')).toHaveLength(1);
  });

  test('replays to the same hash', () => {
    const { g } = entered();
    advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
