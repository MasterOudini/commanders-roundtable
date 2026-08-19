// `Mardu Banner` — the three-colour sacrifice-draw spends the banner.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { MARDU_BANNER_SCRIPT } from './marduBanner';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const BANNER = 'Mardu Banner';

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

function game(): { g: Game; banner: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [[BANNER], []],
    scripts: createRegistry([MARDU_BANNER_SCRIPT]),
  });
  const banner = put(g, 'p1', BANNER);
  settle(g);
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'R', amount: 1 }));
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'W', amount: 1 }));
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'B', amount: 1 }));
  return { g, banner };
}

describe('Mardu Banner', () => {
  test('the sacrifice-draw spends the banner and draws one', () => {
    const { g, banner } = game();
    const logAt = g.log.length;
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: banner, abilityIndex: 1, targets: [] }));
    expect(g.state.cards[banner]?.zone.kind).toBe('graveyard');
    settle(g);
    expect(drawsFor(g, 'p1', logAt)).toBe(1);
  });

  test('replays to the same hash', () => {
    const { g, banner } = game();
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: banner, abilityIndex: 1, targets: [] }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
