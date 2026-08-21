// `Spoils of Evil` — two qualifying cards in the opponent's graveyard make
// {C}{C} and 2 life; the dead land counts not.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { SPOILS_OF_EVIL_SCRIPT } from './spoilsOfEvil';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function spoiled(): Game {
  const g = startedGame({
    players: 2,
    decks: [['Spoils of Evil'], ['Grizzly Bears', 'Sol Ring', 'Swamp']],
    scripts: createRegistry([SPOILS_OF_EVIL_SCRIPT]),
  });
  put(g, 'p2', 'Grizzly Bears', 'graveyard');
  put(g, 'p2', 'Sol Ring', 'graveyard');
  put(g, 'p2', 'Swamp', 'graveyard');
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const spell = put(g, 'p1', 'Spoils of Evil', 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'B', amount: 3 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
  must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'player', id: 'p2' }] }));
  settle(g);
  return g;
}

describe('Spoils of Evil', () => {
  test('a creature and an artifact make {C}{C} and 2 life', () => {
    const g = spoiled();
    expect(g.state.players['p1']?.pool.C).toBe(2);
    expect(g.state.players['p1']?.life).toBe(42);
  });

  test('replays to the same hash', () => {
    const g = spoiled();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
