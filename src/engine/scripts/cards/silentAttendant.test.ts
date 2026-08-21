// `Silent Attendant` — {T} pays 1, past summoning sickness.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { SILENT_ATTENDANT_SCRIPT } from './silentAttendant';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function attended(): Game {
  const g = startedGame({
    players: 2,
    decks: [['Silent Attendant'], []],
    scripts: createRegistry([SILENT_ATTENDANT_SCRIPT]),
  });
  const attendant = put(g, 'p1', 'Silent Attendant');
  settle(g);
  holdEverywhere(g);
  advanceUntil(
    g,
    (s) =>
      s.turn.turnNumber >= 3 &&
      s.turn.activePlayer === 'p1' &&
      s.turn.phase === 'precombatMain',
    120_000,
  );
  must(g.submit({ t: 'ActivateAbility', player: 'p1', card: attendant, abilityIndex: 0 }));
  settle(g);
  return g;
}

describe('Silent Attendant', () => {
  test('the tap pays 1 life', () => {
    const g = attended();
    expect(g.state.players['p1']?.life).toBe(41);
  });

  test('replays to the same hash', () => {
    const g = attended();
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 120_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
