// `Garrison Cat` — dying pays the Human Soldier; a BOUNCE is not dying.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { GARRISON_CAT_SCRIPT } from './garrisonCat';
import { advanceUntil, battlefieldOf, must, nameOf, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

const CAT = 'Garrison Cat';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function soldiers(g: Game): number {
  return battlefieldOf(g, 'p1').filter((id) => nameOf(g, id) === 'Human Soldier').length;
}

function board(): Game {
  return startedGame({
    players: 2,
    decks: [[CAT], []],
    scripts: createRegistry([GARRISON_CAT_SCRIPT]),
  });
}

describe('Garrison Cat', () => {
  test('dying creates the 1/1 Human Soldier', () => {
    const g = board();
    const cat = put(g, 'p1', CAT);
    settle(g);
    must(g.submit({ t: 'ManualMoveCard', player: 'p1', card: cat, to: { kind: 'graveyard', player: 'p1' } }));
    settle(g);
    expect(soldiers(g)).toBe(1);
  });

  test('a BOUNCE pays nothing — leaving is not dying', () => {
    const g = board();
    const cat = put(g, 'p1', CAT);
    settle(g);
    must(g.submit({ t: 'ManualMoveCard', player: 'p1', card: cat, to: { kind: 'hand', player: 'p1' } }));
    settle(g);
    expect(soldiers(g)).toBe(0);
  });

  test('replays to the same hash', () => {
    const g = board();
    const cat = put(g, 'p1', CAT);
    settle(g);
    must(g.submit({ t: 'ManualMoveCard', player: 'p1', card: cat, to: { kind: 'graveyard', player: 'p1' } }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
