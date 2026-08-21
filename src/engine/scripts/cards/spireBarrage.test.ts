// `Spire Barrage` — three Mountains, three at the face.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { SPIRE_BARRAGE_SCRIPT } from './spireBarrage';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function barraged(): Game {
  const g = startedGame({
    players: 2,
    decks: [['Spire Barrage', 'Mountain', 'Mountain', 'Mountain', 'Swamp'], []],
    scripts: createRegistry([SPIRE_BARRAGE_SCRIPT]),
  });
  put(g, 'p1', 'Mountain');
  put(g, 'p1', 'Mountain');
  put(g, 'p1', 'Mountain');
  put(g, 'p1', 'Swamp');
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const spell = put(g, 'p1', 'Spire Barrage', 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'R', amount: 5 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
  must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'player', id: 'p2' }] }));
  settle(g);
  return g;
}

describe('Spire Barrage', () => {
  test('three Mountains deal 3; the Swamp counts not', () => {
    const g = barraged();
    expect(g.state.players['p2']?.life).toBe(37);
  });

  test('replays to the same hash', () => {
    const g = barraged();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
