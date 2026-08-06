// `Dreamstone Hedron` — three cards, one event, counted as MOVES.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { DREAMSTONE_HEDRON_SCRIPT } from './dreamstoneHedron';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const HEDRON = 'Dreamstone Hedron';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function game(): { g: Game; hedron: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [[HEDRON], []],
    scripts: createRegistry([DREAMSTONE_HEDRON_SCRIPT]),
  });
  const hedron = put(g, 'p1', HEDRON);
  settle(g);
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 3 }));
  return { g, hedron };
}

function drawsFor(g: Game, player: string, from: number): number {
  // Counts MOVES, not events — "draw three" arrives as one event of three moves.
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

describe('Dreamstone Hedron', () => {
  test('draws THREE with the Hedron spent as part of the cost', () => {
    const { g, hedron } = game();
    const logAt = g.log.length;
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: hedron, abilityIndex: 1, targets: [] }));
    settle(g);
    expect(drawsFor(g, 'p1', logAt)).toBe(3);
    expect(g.state.cards[hedron]?.zone.kind).toBe('graveyard');
  });

  test('replays to the same hash', () => {
    const { g, hedron } = game();
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: hedron, abilityIndex: 1, targets: [] }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
