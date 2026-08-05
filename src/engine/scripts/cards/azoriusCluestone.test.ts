// `Azorius Cluestone` — the sacrifice-draw, spent at activation, drawn at
// resolution.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { AZORIUS_CLUESTONE_SCRIPT } from './azoriusCluestone';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const CLUESTONE = 'Azorius Cluestone';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function game(): { g: Game; stone: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [[CLUESTONE], []],
    scripts: createRegistry([AZORIUS_CLUESTONE_SCRIPT]),
  });
  const stone = put(g, 'p1', CLUESTONE);
  settle(g);
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'W', amount: 1 }));
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'U', amount: 1 }));
  return { g, stone };
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

describe('Azorius Cluestone', () => {
  test('draws a card with the Cluestone spent as part of the cost', () => {
    const { g, stone } = game();
    const logAt = g.log.length;
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: stone, abilityIndex: 1, targets: [] }));
    settle(g);
    expect(drawsFor(g, 'p1', logAt)).toBe(1);
    expect(g.state.cards[stone]?.zone.kind).toBe('graveyard');
  });

  test('replays to the same hash', () => {
    const { g, stone } = game();
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: stone, abilityIndex: 1, targets: [] }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
