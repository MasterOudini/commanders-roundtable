// `Soulmender` — {T}: gain 1, twice across two turns.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { SOULMENDER_SCRIPT } from './soulmender';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function mended(): Game {
  const g = startedGame({
    players: 2,
    decks: [['Soulmender'], []],
    scripts: createRegistry([SOULMENDER_SCRIPT]),
  });
  const mender = put(g, 'p1', 'Soulmender');
  settle(g);
  holdEverywhere(g);
  advanceUntil(
    g,
    (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain' && s.turn.turnNumber >= 3,
    60_000,
  );
  must(g.submit({ t: 'ActivateAbility', player: 'p1', card: mender, abilityIndex: 0 }));
  settle(g);
  return g;
}

describe('Soulmender', () => {
  test('the tap gains 1', () => {
    const g = mended();
    expect(g.state.players['p1']?.life).toBe(41);
  });

  test('replays to the same hash', () => {
    const g = mended();
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
