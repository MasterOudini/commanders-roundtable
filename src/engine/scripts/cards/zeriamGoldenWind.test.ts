// `Zeriam, Golden Wind` — Zeriam is itself a Griffin, so its own hit makes a
// Griffin token; a non-Griffin connecting beside it adds nothing.
//
// ⚠️ D232's trap: `settle()` returns BEFORE combat damage, so the harness
// advances past combat by PHASE and only then settles.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { ZERIAM_GOLDEN_WIND_SCRIPT } from './zeriamGoldenWind';
import { advanceUntil, battlefieldOf, holdEverywhere, must, nameOf, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

const ZERIAM = 'Zeriam, Golden Wind';
const BEARS = 'Grizzly Bears'; // not a Griffin

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function attacked(): Game {
  const g = startedGame({
    players: 2,
    decks: [[ZERIAM, BEARS], []],
    scripts: createRegistry([ZERIAM_GOLDEN_WIND_SCRIPT]),
  });
  const zeriam = put(g, 'p1', ZERIAM);
  const bears = put(g, 'p1', BEARS);
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
        { card: zeriam, defender: { kind: 'player', id: 'p2' } },
        { card: bears, defender: { kind: 'player', id: 'p2' } },
      ],
    }),
  );
  // Both connect (p2 has no blockers). Advance past combat damage by PHASE.
  advanceUntil(g, (s) => s.turn.phase === 'postcombatMain' || s.turn.turnNumber > 3, 120_000);
  settle(g);
  return g;
}

describe('Zeriam, Golden Wind', () => {
  test('its OWN hit makes exactly one Griffin token; the Bear adds none', () => {
    const g = attacked();
    expect(battlefieldOf(g, 'p1').filter((id) => nameOf(g, id) === 'Griffin')).toHaveLength(1);
    expect(g.state.players['p2']?.life).toBeLessThan(40);
  });

  test('replays to the same hash', () => {
    const g = attacked();
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 120_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
