// `Righteous Cause` — two attackers, two firings: D190's fan-out over
// the attack declaration.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { RIGHTEOUS_CAUSE_SCRIPT } from './righteousCause';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function attacked(): Game {
  const g = startedGame({
    players: 2,
    decks: [['Righteous Cause', 'Grizzly Bears', 'Grizzly Bears'], []],
    scripts: createRegistry([RIGHTEOUS_CAUSE_SCRIPT]),
  });
  put(g, 'p1', 'Righteous Cause');
  const a = put(g, 'p1', 'Grizzly Bears');
  const b = put(g, 'p1', 'Grizzly Bears');
  expect(a).not.toBe(b);
  settle(g);
  holdEverywhere(g);
  advanceUntil(
    g,
    (s) =>
      s.turn.turnNumber >= 3 &&
      s.turn.activePlayer === 'p1' &&
      s.priority.awaiting?.kind === 'declareAttackers',
    120_000,
  );
  must(
    g.submit({
      t: 'DeclareAttackers',
      player: 'p1',
      attackers: [
        { card: a, defender: { kind: 'player', id: 'p2' } },
        { card: b, defender: { kind: 'player', id: 'p2' } },
      ],
    }),
  );
  settle(g);
  return g;
}

describe('Righteous Cause', () => {
  test('two attackers pay 2 — one firing each', () => {
    const g = attacked();
    expect(g.state.players['p1']?.life).toBe(42);
  });

  test('replays to the same hash', () => {
    const g = attacked();
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 120_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
