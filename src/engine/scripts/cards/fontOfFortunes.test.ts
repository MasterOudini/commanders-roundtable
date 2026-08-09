// `Font of Fortunes` — two cards, the Font spent as part of the cost.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { FONT_OF_FORTUNES_SCRIPT } from './fontOfFortunes';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const FONT = 'Font of Fortunes';

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

function game(): { g: Game; font: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [[FONT], []],
    scripts: createRegistry([FONT_OF_FORTUNES_SCRIPT]),
  });
  const font = put(g, 'p1', FONT);
  settle(g);
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'U', amount: 1 }));
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 1 }));
  return { g, font };
}

describe('Font of Fortunes', () => {
  test('draws TWO with the Font spent at activation', () => {
    const { g, font } = game();
    const logAt = g.log.length;
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: font, abilityIndex: 0, targets: [] }));
    expect(g.state.cards[font]?.zone.kind).toBe('graveyard');
    settle(g);
    expect(drawsFor(g, 'p1', logAt)).toBe(2);
  });

  test('replays to the same hash', () => {
    const { g, font } = game();
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: font, abilityIndex: 0, targets: [] }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
