// `Sentinel of the Nameless City` — one Map on entry, a second after a
// real attack: both arms in one game.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { SENTINEL_OF_THE_NAMELESS_CITY_SCRIPT } from './sentinelOfTheNamelessCity';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function tokens(g: Game): number {
  return (g.state.zones.battlefield ?? []).filter((id) => g.state.cards[id]?.isToken).length;
}

function sentineled(): Game {
  const g = startedGame({
    players: 2,
    decks: [['Sentinel of the Nameless City'], []],
    scripts: createRegistry([SENTINEL_OF_THE_NAMELESS_CITY_SCRIPT]),
  });
  const sentinel = put(g, 'p1', 'Sentinel of the Nameless City');
  settle(g);
  expect(tokens(g)).toBe(1);
  holdEverywhere(g);
  advanceUntil(
    g,
    (s) =>
      s.turn.turnNumber >= 3 &&
      s.turn.activePlayer === 'p1' &&
      s.priority.awaiting?.kind === 'declareAttackers',
    120_000,
  );
  must(
    g.submit({
      t: 'DeclareAttackers',
      player: 'p1',
      attackers: [{ card: sentinel, defender: { kind: 'player', id: 'p2' } }],
    }),
  );
  settle(g);
  return g;
}

describe('Sentinel of the Nameless City', () => {
  test('one Map on entry and a second on the attack', () => {
    const g = sentineled();
    expect(tokens(g)).toBe(2);
  });

  test('replays to the same hash', () => {
    const g = sentineled();
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 120_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
