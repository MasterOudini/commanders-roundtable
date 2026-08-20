// `Mutant Town` — tapped entry, and the gain.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { MUTANT_TOWN_SCRIPT } from './mutantTown';
import { advanceUntil, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function towned(): { g: Game; town: InstanceId; enteredTapped: boolean } {
  const g = startedGame({
    players: 2,
    decks: [['Mutant Town'], []],
    scripts: createRegistry([MUTANT_TOWN_SCRIPT]),
  });
  const town = put(g, 'p1', 'Mutant Town');
  settle(g);
  const enteredTapped = g.state.cards[town]?.tapped === true;
  return { g, town, enteredTapped };
}

describe('Mutant Town', () => {
  test('enters TAPPED and gains 1', () => {
    const { g, enteredTapped } = towned();
    expect(enteredTapped).toBe(true);
    expect(g.state.players['p1']?.life).toBe(41);
  });

  test('replays to the same hash', () => {
    const { g } = towned();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
