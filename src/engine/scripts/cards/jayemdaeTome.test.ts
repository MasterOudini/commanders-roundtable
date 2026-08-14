// `Jayemdae Tome` — {4} and the tap draw a card (Arcane Encyclopedia's text
// on its own id).

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { JAYEMDAE_TOME_SCRIPT } from './jayemdaeTome';
import { advanceUntil, idsIn, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const TOME = 'Jayemdae Tome';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function board(): { g: Game; tome: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [[TOME], []],
    scripts: createRegistry([JAYEMDAE_TOME_SCRIPT]),
  });
  const tome = put(g, 'p1', TOME);
  settle(g);
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 4 }));
  return { g, tome };
}

describe('Jayemdae Tome', () => {
  test('paying {4} and the tap draws a card', () => {
    const { g, tome } = board();
    const before = idsIn(g, 'p1', 'hand').length;
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: tome, abilityIndex: 0 }));
    settle(g);
    expect(g.state.cards[tome]?.tapped).toBe(true);
    expect(idsIn(g, 'p1', 'hand').length).toBe(before + 1);
  });

  test('replays to the same hash', () => {
    const { g, tome } = board();
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: tome, abilityIndex: 0 }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
