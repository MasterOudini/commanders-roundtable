// `Rootwater Hunter` — the tap-ping, past its summoning sickness.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { ROOTWATER_HUNTER_SCRIPT } from './rootwaterHunter';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function hunted(): Game {
  const g = startedGame({
    players: 2,
    decks: [['Rootwater Hunter'], []],
    scripts: createRegistry([ROOTWATER_HUNTER_SCRIPT]),
  });
  const hunter = put(g, 'p1', 'Rootwater Hunter');
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
  must(
    g.submit({
      t: 'ActivateAbility',
      player: 'p1',
      card: hunter,
      abilityIndex: 0,
      targets: [{ kind: 'player', id: 'p2' }],
    }),
  );
  settle(g);
  return g;
}

describe('Rootwater Hunter', () => {
  test('pings the chosen player for 1', () => {
    const g = hunted();
    expect(g.state.players['p2']?.life).toBe(39);
  });

  test('replays to the same hash', () => {
    const g = hunted();
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 120_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
