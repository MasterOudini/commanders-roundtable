// `Scalding Devil` — {2}{R} pings the chosen player; no tap, so
// summoning sickness never enters into it.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { SCALDING_DEVIL_SCRIPT } from './scaldingDevil';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function scalded(): Game {
  const g = startedGame({
    players: 2,
    decks: [['Scalding Devil'], []],
    scripts: createRegistry([SCALDING_DEVIL_SCRIPT]),
  });
  const devil = put(g, 'p1', 'Scalding Devil');
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 2 }));
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'R', amount: 1 }));
  must(
    g.submit({
      t: 'ActivateAbility',
      player: 'p1',
      card: devil,
      abilityIndex: 0,
      targets: [{ kind: 'player', id: 'p2' }],
    }),
  );
  settle(g);
  return g;
}

describe('Scalding Devil', () => {
  test('pings the chosen player for 1', () => {
    const g = scalded();
    expect(g.state.players['p2']?.life).toBe(39);
  });

  test('replays to the same hash', () => {
    const g = scalded();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
