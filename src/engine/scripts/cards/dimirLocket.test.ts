// `Dimir Locket` — the hybrid ×4 cost paid all-blue, and BOTH cards of the
// draw counted as MOVES (one event, two moves).

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { DIMIR_LOCKET_SCRIPT } from './dimirLocket';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const LOCKET = 'Dimir Locket';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function game(): { g: Game; locket: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [[LOCKET], []],
    scripts: createRegistry([DIMIR_LOCKET_SCRIPT]),
  });
  const locket = put(g, 'p1', LOCKET);
  settle(g);
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'U', amount: 4 }));
  return { g, locket };
}

function drawsFor(g: Game, player: string, from: number): number {
  // Counts MOVES, not events — "draw two" arrives as one event of two moves.
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

describe('Dimir Locket', () => {
  test('the hybrid cost paid in blue draws TWO, with the Locket spent', () => {
    const { g, locket } = game();
    const logAt = g.log.length;
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: locket, abilityIndex: 1, targets: [] }));
    settle(g);
    expect(drawsFor(g, 'p1', logAt)).toBe(2);
    expect(g.state.cards[locket]?.zone.kind).toBe('graveyard');
  });

  test('replays to the same hash', () => {
    const { g, locket } = game();
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: locket, abilityIndex: 1, targets: [] }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
