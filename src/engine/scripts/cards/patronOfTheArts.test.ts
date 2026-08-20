// `Patron of the Arts` — Treasure on entry AND on death (Noggle Robber's line).

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { PATRON_OF_THE_ARTS_SCRIPT } from './patronOfTheArts';
import { NOGGLE_ROBBER, PATRON_OF_THE_ARTS } from '../../../data/fixtures/engineCards';
import { advanceUntil, must, nameOf, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function treasures(g: Game): number {
  return g.state.zones.battlefield.filter((id) => nameOf(g, id) === 'Treasure').length;
}

describe('Patron of the Arts', () => {
  test('shares its printed text with Noggle Robber', () => {
    expect(PATRON_OF_THE_ARTS.faces[0]?.oracleText).toBe(NOGGLE_ROBBER.faces[0]?.oracleText);
  });

  test('mints a Treasure on entry and another on death', () => {
    const g = startedGame({
      players: 2,
      decks: [['Patron of the Arts'], []],
      scripts: createRegistry([PATRON_OF_THE_ARTS_SCRIPT]),
    });
    const patron = put(g, 'p1', 'Patron of the Arts');
    settle(g);
    expect(treasures(g)).toBe(1);
    must(g.submit({ t: 'ManualMoveCard', player: 'p1', card: patron, to: { kind: 'graveyard', player: 'p1' } }));
    settle(g);
    expect(treasures(g)).toBe(2);
  });

  test('replays to the same hash', () => {
    const g = startedGame({
      players: 2,
      decks: [['Patron of the Arts'], []],
      scripts: createRegistry([PATRON_OF_THE_ARTS_SCRIPT]),
    });
    const patron = put(g, 'p1', 'Patron of the Arts');
    settle(g);
    must(g.submit({ t: 'ManualMoveCard', player: 'p1', card: patron, to: { kind: 'graveyard', player: 'p1' } }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
