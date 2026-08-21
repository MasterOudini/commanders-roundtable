// `Stolen Grain` — 5 off p2, 5 onto the caster.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { STOLEN_GRAIN_SCRIPT } from './stolenGrain';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function stolen(): Game {
  const g = startedGame({
    players: 2,
    decks: [['Stolen Grain'], []],
    scripts: createRegistry([STOLEN_GRAIN_SCRIPT]),
  });
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const spell = put(g, 'p1', 'Stolen Grain', 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'B', amount: 6 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
  must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'player', id: 'p2' }] }));
  settle(g);
  return g;
}

describe('Stolen Grain', () => {
  test('p2 takes 5 and the caster gains 5', () => {
    const g = stolen();
    expect(g.state.players['p2']?.life).toBe(35);
    expect(g.state.players['p1']?.life).toBe(45);
  });

  test('replays to the same hash', () => {
    const g = stolen();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
