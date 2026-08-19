// `Marble Chalice` — the tap gains 1 life, and the tap is the whole price.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { MARBLE_CHALICE_SCRIPT } from './marbleChalice';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

const CHALICE = 'Marble Chalice';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

describe('Marble Chalice', () => {
  test('the tap gains 1 life and turns the chalice', () => {
    const g = startedGame({
      players: 2,
      decks: [[CHALICE], []],
      scripts: createRegistry([MARBLE_CHALICE_SCRIPT]),
    });
    const chalice = put(g, 'p1', CHALICE);
    settle(g);
    // An artifact's {T} carries no summoning sickness — same turn is fine.
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: chalice, abilityIndex: 0, targets: [] }));
    settle(g);
    expect(g.state.players['p1']?.life).toBe(41);
    expect(g.state.cards[chalice]?.tapped).toBe(true);
  });

  test('replays to the same hash', () => {
    const g = startedGame({
      players: 2,
      decks: [[CHALICE], []],
      scripts: createRegistry([MARBLE_CHALICE_SCRIPT]),
    });
    const chalice = put(g, 'p1', CHALICE);
    settle(g);
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: chalice, abilityIndex: 0, targets: [] }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
