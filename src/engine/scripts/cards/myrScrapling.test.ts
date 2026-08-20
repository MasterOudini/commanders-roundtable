// `Myr Scrapling` — sacrifices itself for the counter.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { MYR_SCRAPLING_SCRIPT } from './myrScrapling';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function scrapped(): { g: Game; scrap: InstanceId; bears: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [['Myr Scrapling', 'Grizzly Bears'], []],
    scripts: createRegistry([MYR_SCRAPLING_SCRIPT]),
  });
  const scrap = put(g, 'p1', 'Myr Scrapling');
  const bears = put(g, 'p1', 'Grizzly Bears');
  settle(g);
  advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
  return { g, scrap, bears };
}

describe('Myr Scrapling', () => {
  test('pays itself into the graveyard and the counter lands', () => {
    const { g, scrap, bears } = scrapped();
    must(
      g.submit({
        t: 'ActivateAbility',
        player: 'p1',
        card: scrap,
        abilityIndex: 0,
        targets: [{ kind: 'card', id: bears }],
      }),
    );
    settle(g);
    expect(g.state.cards[scrap]?.zone.kind).toBe('graveyard');
    expect(g.state.cards[bears]?.counters['+1/+1']).toBe(1);
  });

  test('replays to the same hash', () => {
    const { g, scrap, bears } = scrapped();
    must(
      g.submit({
        t: 'ActivateAbility',
        player: 'p1',
        card: scrap,
        abilityIndex: 0,
        targets: [{ kind: 'card', id: bears }],
      }),
    );
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
