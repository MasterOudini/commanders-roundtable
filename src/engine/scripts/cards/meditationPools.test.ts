// `Meditation Pools` — enters tapped, and the sacrifice-draw spends the land.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { MEDITATION_POOLS_SCRIPT } from './meditationPools';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const POOLS = 'Meditation Pools';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function drawsFor(g: Game, player: string, from: number): number {
  return g.log.slice(from).reduce(
    (n, e) =>
      e.body.t === 'CardsMoved'
        ? n +
          e.body.moves.filter(
            (m) => m.from.kind === 'library' && m.to.kind === 'hand' && m.to.player === player,
          ).length
        : n,
    0,
  );
}

function game(): { g: Game; pools: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [[POOLS], []],
    scripts: createRegistry([MEDITATION_POOLS_SCRIPT]),
  });
  const pools = put(g, 'p1', POOLS);
  settle(g);
  // The {T} in the cost needs the land untapped — it entered tapped (D134).
  expect(g.state.cards[pools]?.tapped).toBe(true);
  must(g.submit({ t: 'ManualSetTapped', player: 'p1', cards: [pools], tapped: false }));
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 4 }));
  return { g, pools };
}

describe('Meditation Pools', () => {
  test('entered tapped, and the sacrifice-draw spends it', () => {
    const { g, pools } = game();
    const logAt = g.log.length;
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: pools, abilityIndex: 1, targets: [] }));
    expect(g.state.cards[pools]?.zone.kind).toBe('graveyard');
    settle(g);
    expect(drawsFor(g, 'p1', logAt)).toBe(1);
  });

  test('replays to the same hash', () => {
    const { g, pools } = game();
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: pools, abilityIndex: 1, targets: [] }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
