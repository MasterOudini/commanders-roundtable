// `Pitiless Plunderer` — another creature's death pays; its own does not.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { PITILESS_PLUNDERER_SCRIPT } from './pitilessPlunderer';
import { advanceUntil, must, nameOf, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function treasures(g: Game): number {
  return g.state.zones.battlefield.filter((id) => nameOf(g, id) === 'Treasure').length;
}

describe('Pitiless Plunderer', () => {
  test('a Bears death mints one; the Plunderer dying mints nothing more', () => {
    const g = startedGame({
      players: 2,
      decks: [['Pitiless Plunderer', 'Grizzly Bears'], []],
      scripts: createRegistry([PITILESS_PLUNDERER_SCRIPT]),
    });
    const plunderer = put(g, 'p1', 'Pitiless Plunderer');
    const bears = put(g, 'p1', 'Grizzly Bears');
    settle(g);
    must(g.submit({ t: 'ManualMoveCard', player: 'p1', card: bears, to: { kind: 'graveyard', player: 'p1' } }));
    settle(g);
    expect(treasures(g)).toBe(1);
    must(
      g.submit({ t: 'ManualMoveCard', player: 'p1', card: plunderer, to: { kind: 'graveyard', player: 'p1' } }),
    );
    settle(g);
    expect(treasures(g)).toBe(1);
  });

  test('replays to the same hash', () => {
    const g = startedGame({
      players: 2,
      decks: [['Pitiless Plunderer', 'Grizzly Bears'], []],
      scripts: createRegistry([PITILESS_PLUNDERER_SCRIPT]),
    });
    put(g, 'p1', 'Pitiless Plunderer');
    const bears = put(g, 'p1', 'Grizzly Bears');
    settle(g);
    must(g.submit({ t: 'ManualMoveCard', player: 'p1', card: bears, to: { kind: 'graveyard', player: 'p1' } }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
