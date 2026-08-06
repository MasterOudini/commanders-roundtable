// `Dire Fleet Hoarder` — dying leaves a Treasure behind.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { DIRE_FLEET_HOARDER_SCRIPT } from './direFleetHoarder';
import { advanceUntil, battlefieldOf, must, nameOf, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

const HOARDER = 'Dire Fleet Hoarder';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

describe('Dire Fleet Hoarder', () => {
  test('dying creates a real Treasure token', () => {
    const g = startedGame({
      players: 2,
      decks: [[HOARDER], []],
      scripts: createRegistry([DIRE_FLEET_HOARDER_SCRIPT]),
    });
    const hoarder = put(g, 'p1', HOARDER);
    settle(g);
    must(
      g.submit({ t: 'ManualMoveCard', player: 'p1', card: hoarder, to: { kind: 'graveyard', player: 'p1' } }),
    );
    settle(g);
    expect(battlefieldOf(g, 'p1').filter((id) => nameOf(g, id) === 'Treasure')).toHaveLength(1);
  });

  test('replays to the same hash', () => {
    const g = startedGame({
      players: 2,
      decks: [[HOARDER], []],
      scripts: createRegistry([DIRE_FLEET_HOARDER_SCRIPT]),
    });
    const hoarder = put(g, 'p1', HOARDER);
    settle(g);
    must(
      g.submit({ t: 'ManualMoveCard', player: 'p1', card: hoarder, to: { kind: 'graveyard', player: 'p1' } }),
    );
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
