// `Skyclave Cleric // Skyclave Basilica` — THE FIRST MDFC SCRIPT: entering
// as the Cleric gains 2; PLAYED as the Basilica (faceIndex 1) it enters a
// tapped land and gains nobody anything.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { SKYCLAVE_CLERIC_SCRIPT } from './skyclaveCleric';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

const NAME = 'Skyclave Cleric // Skyclave Basilica';

function fresh(): Game {
  const g = startedGame({
    players: 2,
    decks: [[NAME], []],
    scripts: createRegistry([SKYCLAVE_CLERIC_SCRIPT]),
  });
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  return g;
}

describe('Skyclave Cleric // Skyclave Basilica', () => {
  test('entering as the Cleric gains 2 life', () => {
    const g = fresh();
    put(g, 'p1', NAME);
    settle(g);
    expect(g.state.players['p1']?.life).toBe(42);
  });

  test('played as the Basilica it enters a tapped land and gains nothing', () => {
    const g = fresh();
    const card = put(g, 'p1', NAME, 'hand');
    must(g.submit({ t: 'PlayLand', player: 'p1', card, faceIndex: 1 }));
    settle(g);
    expect(g.state.cards[card]?.zone.kind).toBe('battlefield');
    expect(g.state.cards[card]?.faceIndex).toBe(1);
    expect(g.state.cards[card]?.tapped).toBe(true);
    expect(g.state.players['p1']?.life).toBe(40);
  });

  test('replays to the same hash', () => {
    const g = fresh();
    put(g, 'p1', NAME);
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
