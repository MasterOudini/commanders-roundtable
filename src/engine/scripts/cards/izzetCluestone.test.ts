// `Izzet Cluestone` — the sacrifice-draw at `#a1`.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { IZZET_CLUESTONE_SCRIPT } from './izzetCluestone';
import { advanceUntil, idsIn, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const CLUESTONE = 'Izzet Cluestone';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function board(): { g: Game; cluestone: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [[CLUESTONE], []],
    scripts: createRegistry([IZZET_CLUESTONE_SCRIPT]),
  });
  const cluestone = put(g, 'p1', CLUESTONE);
  settle(g);
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'U', amount: 1 }));
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'R', amount: 1 }));
  return { g, cluestone };
}

describe('Izzet Cluestone', () => {
  test('paying {U}{R}, the tap and itself draws a card', () => {
    const { g, cluestone } = board();
    const before = idsIn(g, 'p1', 'hand').length;
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: cluestone, abilityIndex: 1 }));
    settle(g);
    expect(g.state.cards[cluestone]?.zone.kind).toBe('graveyard');
    expect(idsIn(g, 'p1', 'hand').length).toBe(before + 1);
  });

  test('replays to the same hash', () => {
    const { g, cluestone } = board();
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: cluestone, abilityIndex: 1 }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
