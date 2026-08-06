// `Crested Herdcaller` — the ETB Dinosaur, pinned to the TRAMPLE printing —
// the vanilla 3/3 Dinosaur is one row over in the table, and matching it
// would create the wrong permanent on a card that reads correctly (D131).

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { CRESTED_HERDCALLER_SCRIPT } from './crestedHerdcaller';
import { DINOSAUR_TOKEN } from '../../../data/fixtures/engineCards';
import { advanceUntil, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

const HERDCALLER = 'Crested Herdcaller';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function game(): Game {
  return startedGame({
    players: 2,
    decks: [[HERDCALLER], []],
    scripts: createRegistry([CRESTED_HERDCALLER_SCRIPT]),
  });
}

describe('Crested Herdcaller', () => {
  test('entering creates the trample Dinosaur, by its exact printing', () => {
    const g = game();
    put(g, 'p1', HERDCALLER);
    settle(g);
    const tokens = Object.values(g.state.cards).filter((c) => c.isToken);
    expect(tokens).toHaveLength(1);
    expect(tokens[0]?.printingId).toBe(DINOSAUR_TOKEN.scryfallId);
    expect(tokens[0]?.zone.kind).toBe('battlefield');
  });

  test('replays to the same hash', () => {
    const g = game();
    put(g, 'p1', HERDCALLER);
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
