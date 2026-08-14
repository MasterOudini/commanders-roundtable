// `Kyoshi Village` — {4}, the tap and itself pay for the draw.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { KYOSHI_VILLAGE_SCRIPT } from './kyoshiVillage';
import { advanceUntil, idsIn, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const VILLAGE = 'Kyoshi Village';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function board(): { g: Game; village: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [[VILLAGE], []],
    scripts: createRegistry([KYOSHI_VILLAGE_SCRIPT]),
  });
  const village = put(g, 'p1', VILLAGE);
  settle(g);
  // The Village enters TAPPED (line 0 is D134's rule), and its `#a1` cost
  // includes {T} — straighten it before paying.
  must(g.submit({ t: 'ManualSetTapped', player: 'p1', cards: [village], tapped: false }));
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 4 }));
  return { g, village };
}

describe('Kyoshi Village', () => {
  test('paying {4}, the tap and itself draws a card', () => {
    const { g, village } = board();
    const before = idsIn(g, 'p1', 'hand').length;
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: village, abilityIndex: 1 }));
    settle(g);
    expect(g.state.cards[village]?.zone.kind).toBe('graveyard');
    expect(idsIn(g, 'p1', 'hand').length).toBe(before + 1);
  });

  test('replays to the same hash', () => {
    const { g, village } = board();
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: village, abilityIndex: 1 }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
