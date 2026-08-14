// `Izzet Locket` — the hybrid ×4 pays in all-blue for two cards.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { IZZET_LOCKET_SCRIPT } from './izzetLocket';
import { advanceUntil, idsIn, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const LOCKET = 'Izzet Locket';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function board(): { g: Game; locket: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [[LOCKET], []],
    scripts: createRegistry([IZZET_LOCKET_SCRIPT]),
  });
  const locket = put(g, 'p1', LOCKET);
  settle(g);
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'U', amount: 4 }));
  return { g, locket };
}

describe('Izzet Locket', () => {
  test('paying {U/R} four times in blue draws two cards', () => {
    const { g, locket } = board();
    const before = idsIn(g, 'p1', 'hand').length;
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: locket, abilityIndex: 1 }));
    settle(g);
    expect(g.state.cards[locket]?.zone.kind).toBe('graveyard');
    expect(idsIn(g, 'p1', 'hand').length).toBe(before + 2);
  });

  test('replays to the same hash', () => {
    const { g, locket } = board();
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: locket, abilityIndex: 1 }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
