// `Overgrown Estate` — a land pays for 3 life.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { OVERGROWN_ESTATE_SCRIPT } from './overgrownEstate';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function estated(): { g: Game; estate: InstanceId; land: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [['Overgrown Estate', 'Mountain'], []],
    scripts: createRegistry([OVERGROWN_ESTATE_SCRIPT]),
  });
  const estate = put(g, 'p1', 'Overgrown Estate');
  const land = put(g, 'p1', 'Mountain');
  settle(g);
  advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
  return { g, estate, land };
}

describe('Overgrown Estate', () => {
  test('the land pays; 3 life arrives', () => {
    const { g, estate, land } = estated();
    must(
      g.submit({
        t: 'ActivateAbility',
        player: 'p1',
        card: estate,
        abilityIndex: 0,
        sacrifice: land,
      }),
    );
    settle(g);
    expect(g.state.cards[land]?.zone.kind).toBe('graveyard');
    expect(g.state.players['p1']?.life).toBe(43);
  });

  test('replays to the same hash', () => {
    const { g, estate, land } = estated();
    must(
      g.submit({
        t: 'ActivateAbility',
        player: 'p1',
        card: estate,
        abilityIndex: 0,
        sacrifice: land,
      }),
    );
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
