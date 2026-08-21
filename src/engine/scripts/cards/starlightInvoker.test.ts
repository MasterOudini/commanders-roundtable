// `Starlight Invoker` — {7}{W} gains 5, no tap.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { STARLIGHT_INVOKER_SCRIPT } from './starlightInvoker';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function invoked(): Game {
  const g = startedGame({
    players: 2,
    decks: [['Starlight Invoker'], []],
    scripts: createRegistry([STARLIGHT_INVOKER_SCRIPT]),
  });
  const invoker = put(g, 'p1', 'Starlight Invoker');
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'W', amount: 8 }));
  must(g.submit({ t: 'ActivateAbility', player: 'p1', card: invoker, abilityIndex: 0 }));
  settle(g);
  return g;
}

describe('Starlight Invoker', () => {
  test('the activation gains 5', () => {
    const g = invoked();
    expect(g.state.players['p1']?.life).toBe(45);
  });

  test('replays to the same hash', () => {
    const g = invoked();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
