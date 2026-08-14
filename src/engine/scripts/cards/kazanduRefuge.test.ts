// `Kazandu Refuge` — both printed rules on entry: tapped and the life.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { KAZANDU_REFUGE_SCRIPT } from './kazanduRefuge';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const REFUGE = 'Kazandu Refuge';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function entered(): { g: Game; refuge: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [[REFUGE], []],
    scripts: createRegistry([KAZANDU_REFUGE_SCRIPT]),
  });
  const refuge = put(g, 'p1', REFUGE, 'hand');
  must(g.submit({ t: 'PlayLand', player: 'p1', card: refuge }));
  settle(g);
  return { g, refuge };
}

describe('Kazandu Refuge', () => {
  test('enters tapped AND pays 1 life — both printed rules', () => {
    const { g, refuge } = entered();
    expect(g.state.cards[refuge]?.tapped).toBe(true);
    expect(g.state.players.p1?.life).toBe(41);
  });

  test('replays to the same hash', () => {
    const { g } = entered();
    advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
