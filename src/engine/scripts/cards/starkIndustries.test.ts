// `Stark Industries` — the refuge: tapped entry AND the gain.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { STARK_INDUSTRIES_SCRIPT } from './starkIndustries';
import { advanceUntil, holdEverywhere, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function starked(): { g: Game; land: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [['Stark Industries'], []],
    scripts: createRegistry([STARK_INDUSTRIES_SCRIPT]),
  });
  holdEverywhere(g);
  const land = put(g, 'p1', 'Stark Industries');
  settle(g);
  return { g, land };
}

describe('Stark Industries', () => {
  test('enters tapped and pays 1 life', () => {
    const { g, land } = starked();
    expect(g.state.cards[land]?.tapped).toBe(true);
    expect(g.state.players['p1']?.life).toBe(41);
  });

  test('replays to the same hash', () => {
    const { g } = starked();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
