// `Gruul Locket` — the hybrid {R/G}×4 sacrifice-draw-two.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { GRUUL_LOCKET_SCRIPT } from './gruulLocket';
import { advanceUntil, idsIn, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const LOCKET = 'Gruul Locket';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function board(): { g: Game; locket: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [[LOCKET], []],
    scripts: createRegistry([GRUUL_LOCKET_SCRIPT]),
  });
  const locket = put(g, 'p1', LOCKET);
  settle(g);
  advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'R', amount: 2 }));
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'G', amount: 2 }));
  return { g, locket };
}

describe('Gruul Locket', () => {
  test('sacrifices itself to draw two, hybrid pips split across both colours', () => {
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
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
