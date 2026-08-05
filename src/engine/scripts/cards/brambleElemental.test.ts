// `Bramble Elemental` — an Aura landing on it makes two DISTINCT Saprolings;
// an Aura landing elsewhere makes none.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { BRAMBLE_ELEMENTAL_SCRIPT } from './brambleElemental';
import { advanceUntil, battlefieldOf, must, nameOf, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const ELEMENTAL = 'Bramble Elemental';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function board(): { g: Game; elemental: InstanceId; aura: InstanceId; bears: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [[ELEMENTAL, 'Pacifism', 'Grizzly Bears'], []],
    scripts: createRegistry([BRAMBLE_ELEMENTAL_SCRIPT]),
  });
  const elemental = put(g, 'p1', ELEMENTAL);
  const bears = put(g, 'p1', 'Grizzly Bears');
  const aura = put(g, 'p1', 'Pacifism');
  settle(g);
  return { g, elemental, aura, bears };
}

function saprolings(g: Game): InstanceId[] {
  return battlefieldOf(g, 'p1').filter((id) => nameOf(g, id) === 'Saproling');
}

describe('Bramble Elemental', () => {
  test('an Aura attached to IT makes two distinct Saprolings; attached elsewhere, none', () => {
    const { g, elemental, aura, bears } = board();
    must(g.submit({ t: 'ManualAttach', player: 'p1', card: aura, to: bears }));
    settle(g);
    expect(saprolings(g)).toHaveLength(0);
    must(g.submit({ t: 'ManualAttach', player: 'p1', card: aura, to: elemental }));
    settle(g);
    const tokens = saprolings(g);
    expect(tokens).toHaveLength(2);
    expect(new Set(tokens).size).toBe(2);
  });

  test('replays to the same hash', () => {
    const { g, elemental, aura } = board();
    must(g.submit({ t: 'ManualAttach', player: 'p1', card: aura, to: elemental }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
