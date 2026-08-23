// `Waterfront District` — the twentieth member of the dual-sac-land family: it ENTERS
// TAPPED, and only once untapped can it spend itself for a card.
//
// ⚠️ Built on the shipped family's own test shape (botanicalPlaza.test.ts):
// it enters from the GRAVEYARD so the enters-tapped replacement actually
// fires, and the draw is counted from the LOG rather than from hand size —
// which sidesteps put() skewing the hand (D232).

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { WATERFRONT_DISTRICT_SCRIPT } from './waterfrontDistrict';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const LAND = 'Waterfront District';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function game(): { g: Game; land: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [[LAND], []],
    scripts: createRegistry([WATERFRONT_DISTRICT_SCRIPT]),
  });
  const land = put(g, 'p1', LAND, 'graveyard');
  must(
    g.submit({ t: 'ManualMoveCard', player: 'p1', card: land, to: { kind: 'battlefield', player: 'p1' } }),
  );
  settle(g);
  return { g, land };
}

function drawsFor(g: Game, player: string, from: number): number {
  return g.log
    .slice(from)
    .filter(
      (e) =>
        e.body.t === 'CardsMoved' &&
        e.body.moves.some(
          (m) => m.from.kind === 'library' && m.to.kind === 'hand' && m.to.player === player,
        ),
    ).length;
}

function fund(g: Game, land: InstanceId): void {
  must(g.submit({ t: 'ManualSetTapped', player: 'p1', cards: [land], tapped: false }));
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'U', amount: 1 }));
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'B', amount: 1 }));
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 2 }));
}

describe('Waterfront District', () => {
  test('it ENTERS TAPPED', () => {
    const { g, land } = game();
    expect(g.state.cards[land]?.tapped).toBe(true);
  });

  test('untapped and funded, the sacrifice draws exactly one', () => {
    const { g, land } = game();
    fund(g, land);
    const logAt = g.log.length;
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: land, abilityIndex: 1, targets: [] }));
    settle(g);
    expect(drawsFor(g, 'p1', logAt)).toBe(1);
    expect(g.state.cards[land]?.zone.kind).toBe('graveyard');
  });

  test('replays to the same hash', () => {
    const { g, land } = game();
    fund(g, land);
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: land, abilityIndex: 1, targets: [] }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
