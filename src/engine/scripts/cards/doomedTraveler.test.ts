// `Doomed Traveler` — dying leaves a 1/1 flying Spirit behind.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { DOOMED_TRAVELER_SCRIPT } from './doomedTraveler';
import { advanceUntil, battlefieldOf, must, nameOf, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

const TRAVELER = 'Doomed Traveler';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

describe('Doomed Traveler', () => {
  test('dying creates the 1/1 Spirit', () => {
    const g = startedGame({
      players: 2,
      decks: [[TRAVELER], []],
      scripts: createRegistry([DOOMED_TRAVELER_SCRIPT]),
    });
    const traveler = put(g, 'p1', TRAVELER);
    settle(g);
    must(
      g.submit({ t: 'ManualMoveCard', player: 'p1', card: traveler, to: { kind: 'graveyard', player: 'p1' } }),
    );
    settle(g);
    expect(battlefieldOf(g, 'p1').filter((id) => nameOf(g, id) === 'Spirit')).toHaveLength(1);
  });

  test('replays to the same hash', () => {
    const g = startedGame({
      players: 2,
      decks: [[TRAVELER], []],
      scripts: createRegistry([DOOMED_TRAVELER_SCRIPT]),
    });
    const traveler = put(g, 'p1', TRAVELER);
    settle(g);
    must(
      g.submit({ t: 'ManualMoveCard', player: 'p1', card: traveler, to: { kind: 'graveyard', player: 'p1' } }),
    );
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
