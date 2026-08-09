// `Foggy Bottom Swamp` — enters tapped, and the sacrifice-draw spends the
// land.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { FOGGY_BOTTOM_SWAMP_SCRIPT } from './foggyBottomSwamp';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const SWAMP = 'Foggy Bottom Swamp';

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

function game(): { g: Game; swamp: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [[SWAMP], []],
    scripts: createRegistry([FOGGY_BOTTOM_SWAMP_SCRIPT]),
  });
  const swamp = put(g, 'p1', SWAMP);
  settle(g);
  // The {T} in the cost needs the land untapped — it entered tapped (D134).
  must(g.submit({ t: 'ManualSetTapped', player: 'p1', cards: [swamp], tapped: false }));
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 4 }));
  return { g, swamp };
}

describe('Foggy Bottom Swamp', () => {
  test('entered tapped, and the sacrifice-draw spends it', () => {
    const { g, swamp } = game();
    const logAt = g.log.length;
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: swamp, abilityIndex: 1, targets: [] }));
    expect(g.state.cards[swamp]?.zone.kind).toBe('graveyard');
    settle(g);
    expect(drawsFor(g, 'p1', logAt)).toBe(1);
  });

  test('replays to the same hash', () => {
    const { g, swamp } = game();
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: swamp, abilityIndex: 1, targets: [] }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
