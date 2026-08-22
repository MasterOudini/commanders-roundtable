// `TCRI Building` — Swiftwater Cliffs' exact text on its own id: tapped and
// the life, both printed rules.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { TCRI_BUILDING_SCRIPT } from './tcriBuilding';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const BUILDING = 'TCRI Building';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function entered(): { g: Game; building: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [[BUILDING], []],
    scripts: createRegistry([TCRI_BUILDING_SCRIPT]),
  });
  const building = put(g, 'p1', BUILDING, 'hand');
  must(g.submit({ t: 'PlayLand', player: 'p1', card: building }));
  settle(g);
  return { g, building };
}

describe('TCRI Building', () => {
  test('enters tapped AND gains 1 life', () => {
    const { g, building } = entered();
    expect(g.state.cards[building]?.tapped).toBe(true);
    expect(g.state.players.p1?.life).toBe(41);
  });

  test('replays to the same hash', () => {
    const { g } = entered();
    advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
