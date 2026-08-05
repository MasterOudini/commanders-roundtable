// `Birthing Boughs` — an artifact's {T} needs no summoning-sickness wait, and
// the Shapeshifter is real.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { BIRTHING_BOUGHS_SCRIPT } from './birthingBoughs';
import { advanceUntil, battlefieldOf, must, nameOf, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const BOUGHS = 'Birthing Boughs';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function game(): { g: Game; boughs: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [[BOUGHS], []],
    scripts: createRegistry([BIRTHING_BOUGHS_SCRIPT]),
  });
  const boughs = put(g, 'p1', BOUGHS);
  settle(g);
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 4 }));
  return { g, boughs };
}

describe('Birthing Boughs', () => {
  test('creates a real 2/2 Shapeshifter, the Boughs turned by the cost', () => {
    const { g, boughs } = game();
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: boughs, abilityIndex: 0, targets: [] }));
    settle(g);
    expect(battlefieldOf(g, 'p1').filter((id) => nameOf(g, id) === 'Shapeshifter')).toHaveLength(1);
    expect(g.state.cards[boughs]?.tapped).toBe(true);
  });

  test('replays to the same hash', () => {
    const { g, boughs } = game();
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: boughs, abilityIndex: 0, targets: [] }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
