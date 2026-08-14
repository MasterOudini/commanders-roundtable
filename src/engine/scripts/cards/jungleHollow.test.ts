// `Jungle Hollow` — both printed rules on entry: tapped and the life.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { JUNGLE_HOLLOW_SCRIPT } from './jungleHollow';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const HOLLOW = 'Jungle Hollow';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function entered(): { g: Game; hollow: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [[HOLLOW], []],
    scripts: createRegistry([JUNGLE_HOLLOW_SCRIPT]),
  });
  const hollow = put(g, 'p1', HOLLOW, 'hand');
  must(g.submit({ t: 'PlayLand', player: 'p1', card: hollow }));
  settle(g);
  return { g, hollow };
}

describe('Jungle Hollow', () => {
  test('enters tapped AND pays 1 life — both printed rules', () => {
    const { g, hollow } = entered();
    expect(g.state.cards[hollow]?.zone.kind).toBe('battlefield');
    expect(g.state.cards[hollow]?.tapped).toBe(true);
    expect(g.state.players.p1?.life).toBe(41);
  });

  test('replays to the same hash', () => {
    const { g } = entered();
    advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
