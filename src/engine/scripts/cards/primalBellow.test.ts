// `Primal Bellow` — the pump counts Forests, and only mine.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { derive } from '../../derive';
import { createRegistry } from '../registry';
import { PRIMAL_BELLOW_SCRIPT } from './primalBellow';
import { ORACLE, advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function bellowed(): { g: Game; bears: string } {
  const g = startedGame({
    players: 2,
    decks: [['Primal Bellow', 'Grizzly Bears'], []],
    scripts: createRegistry([PRIMAL_BELLOW_SCRIPT]),
  });
  const bears = put(g, 'p1', 'Grizzly Bears');
  put(g, 'p1', 'Forest');
  put(g, 'p1', 'Forest');
  put(g, 'p1', 'Forest');
  put(g, 'p2', 'Forest');
  settle(g);
  const spell = put(g, 'p1', 'Primal Bellow', 'hand');
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 20_000);
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'G', amount: 1 }));
  must(
    g.submit({ t: 'CastSpell', player: 'p1', card: spell, targets: [{ kind: 'card', id: bears }] }),
  );
  settle(g);
  return { g, bears };
}

describe('Primal Bellow', () => {
  test('three of my Forests make the Bears a 5/5 — the opponent Forest does not count', () => {
    const { g, bears } = bellowed();
    const d = derive(g.state, ORACLE, g.deps.scripts, bears);
    expect(d.power).toBe(5);
    expect(d.toughness).toBe(5);
  });

  test('replays to the same hash', () => {
    const { g } = bellowed();
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
