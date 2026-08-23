// `Voyaging Satyr` — the {T} untaps a land, and the twin's shape is proven
// on the same two branches Blossom Dryad pins.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { VOYAGING_SATYR_SCRIPT } from './voyagingSatyr';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const SATYR = 'Voyaging Satyr';
const LAND = 'Forest';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function board(): { g: Game; satyr: InstanceId; land: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [[SATYR, LAND], []],
    scripts: createRegistry([VOYAGING_SATYR_SCRIPT]),
  });
  const satyr = put(g, 'p1', SATYR);
  const land = put(g, 'p1', LAND);
  settle(g);
  // Summoning sickness holds the {T} back until p1's next turn.
  advanceUntil(g, (s) => s.turn.turnNumber >= 3 && s.priority.awaiting === null, 60_000);
  must(g.submit({ t: 'ManualSetTapped', player: 'p1', cards: [land], tapped: true }));
  return { g, satyr, land };
}

describe('Voyaging Satyr', () => {
  test('the Satyr taps and the land comes up', () => {
    const { g, satyr, land } = board();
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: satyr, abilityIndex: 0 }));
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: land }] }));
    settle(g);
    expect(g.state.cards[land]?.tapped).toBe(false);
    expect(g.state.cards[satyr]?.tapped).toBe(true);
  });

  test('replays to the same hash', () => {
    const { g, satyr, land } = board();
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: satyr, abilityIndex: 0 }));
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: land }] }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
