// `Memorial to Genius` — the sacrifice draws TWO, counted in moves (D163).

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { MEMORIAL_TO_GENIUS_SCRIPT } from './memorialToGenius';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const MEMORIAL = 'Memorial to Genius';

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

function game(): { g: Game; memorial: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [[MEMORIAL], []],
    scripts: createRegistry([MEMORIAL_TO_GENIUS_SCRIPT]),
  });
  const memorial = put(g, 'p1', MEMORIAL);
  settle(g);
  must(g.submit({ t: 'ManualSetTapped', player: 'p1', cards: [memorial], tapped: false }));
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 4 }));
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'U', amount: 1 }));
  return { g, memorial };
}

describe('Memorial to Genius', () => {
  test('the sacrifice-draw spends it and draws two', () => {
    const { g, memorial } = game();
    const logAt = g.log.length;
    must(
      g.submit({ t: 'ActivateAbility', player: 'p1', card: memorial, abilityIndex: 1, targets: [] }),
    );
    expect(g.state.cards[memorial]?.zone.kind).toBe('graveyard');
    settle(g);
    expect(drawsFor(g, 'p1', logAt)).toBe(2);
  });

  test('replays to the same hash', () => {
    const { g, memorial } = game();
    must(
      g.submit({ t: 'ActivateAbility', player: 'p1', card: memorial, abilityIndex: 1, targets: [] }),
    );
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
