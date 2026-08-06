// `Elgaud Inquisitor` — dying leaves the flying Spirit behind.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { ELGAUD_INQUISITOR_SCRIPT } from './elgaudInquisitor';
import { advanceUntil, battlefieldOf, must, nameOf, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

const INQUISITOR = 'Elgaud Inquisitor';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

describe('Elgaud Inquisitor', () => {
  test('dying creates the 1/1 Spirit', () => {
    const g = startedGame({
      players: 2,
      decks: [[INQUISITOR], []],
      scripts: createRegistry([ELGAUD_INQUISITOR_SCRIPT]),
    });
    const inquisitor = put(g, 'p1', INQUISITOR);
    settle(g);
    must(
      g.submit({ t: 'ManualMoveCard', player: 'p1', card: inquisitor, to: { kind: 'graveyard', player: 'p1' } }),
    );
    settle(g);
    expect(battlefieldOf(g, 'p1').filter((id) => nameOf(g, id) === 'Spirit')).toHaveLength(1);
  });

  test('replays to the same hash', () => {
    const g = startedGame({
      players: 2,
      decks: [[INQUISITOR], []],
      scripts: createRegistry([ELGAUD_INQUISITOR_SCRIPT]),
    });
    const inquisitor = put(g, 'p1', INQUISITOR);
    settle(g);
    must(
      g.submit({ t: 'ManualMoveCard', player: 'p1', card: inquisitor, to: { kind: 'graveyard', player: 'p1' } }),
    );
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
