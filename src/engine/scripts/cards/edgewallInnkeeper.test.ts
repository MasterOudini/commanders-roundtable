// `Edgewall Innkeeper` — an ADVENTURE creature cast draws; a plain creature
// does not.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { EDGEWALL_INNKEEPER_SCRIPT } from './edgewallInnkeeper';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

const INNKEEPER = 'Edgewall Innkeeper';
const ADVENTURE = 'Tuinvale Treefolk // Oaken Boon';
const BEARS = 'Grizzly Bears';

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

function board(): Game {
  const g = startedGame({
    players: 2,
    decks: [[INNKEEPER, ADVENTURE, BEARS], []],
    scripts: createRegistry([EDGEWALL_INNKEEPER_SCRIPT]),
  });
  put(g, 'p1', INNKEEPER);
  settle(g);
  return g;
}

describe('Edgewall Innkeeper', () => {
  test('casting the CREATURE half of an adventure card draws', () => {
    const g = board();
    const treefolk = put(g, 'p1', ADVENTURE, 'hand');
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'G', amount: 1 }));
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 5 }));
    const logAt = g.log.length;
    must(g.submit({ t: 'CastSpell', player: 'p1', card: treefolk }));
    settle(g);
    expect(drawsFor(g, 'p1', logAt)).toBe(1);
  });

  test('a creature with NO adventure pays nothing', () => {
    const g = board();
    const bears = put(g, 'p1', BEARS, 'hand');
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'G', amount: 1 }));
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 1 }));
    const logAt = g.log.length;
    must(g.submit({ t: 'CastSpell', player: 'p1', card: bears }));
    settle(g);
    expect(drawsFor(g, 'p1', logAt)).toBe(0);
  });

  test('replays to the same hash', () => {
    const g = board();
    const treefolk = put(g, 'p1', ADVENTURE, 'hand');
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'G', amount: 1 }));
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 5 }));
    must(g.submit({ t: 'CastSpell', player: 'p1', card: treefolk }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
