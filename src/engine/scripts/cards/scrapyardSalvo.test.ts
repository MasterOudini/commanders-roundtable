// `Scrapyard Salvo` — two buried artifacts bill the player 2; the
// creature card in the graveyard counts not.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { SCRAPYARD_SALVO_SCRIPT } from './scrapyardSalvo';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function salvoed(): Game {
  const g = startedGame({
    players: 2,
    decks: [
      ['Scrapyard Salvo', 'Sol Ring', 'Sol Ring', 'Grizzly Bears'],
      [],
    ],
    scripts: createRegistry([SCRAPYARD_SALVO_SCRIPT]),
  });
  put(g, 'p1', 'Sol Ring', 'graveyard');
  put(g, 'p1', 'Sol Ring', 'graveyard');
  put(g, 'p1', 'Grizzly Bears', 'graveyard');
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const spell = put(g, 'p1', 'Scrapyard Salvo', 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 1 }));
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'R', amount: 2 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
  must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'player', id: 'p2' }] }));
  settle(g);
  return g;
}

describe('Scrapyard Salvo', () => {
  test('two buried artifacts bill 2; the buried creature counts not', () => {
    const g = salvoed();
    expect(g.state.players['p2']?.life).toBe(38);
  });

  test('replays to the same hash', () => {
    const g = salvoed();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
