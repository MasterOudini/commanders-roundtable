// `Slithering Cryptid` — the entry pays a Mutagen.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { SLITHERING_CRYPTID_SCRIPT } from './slitheringCryptid';
import { advanceUntil, holdEverywhere, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function crypted(): Game {
  const g = startedGame({
    players: 2,
    decks: [['Slithering Cryptid'], []],
    scripts: createRegistry([SLITHERING_CRYPTID_SCRIPT]),
  });
  holdEverywhere(g);
  put(g, 'p1', 'Slithering Cryptid');
  settle(g);
  return g;
}

describe('Slithering Cryptid', () => {
  test('the entry creates one Mutagen token', () => {
    const g = crypted();
    const tokens = (g.state.zones.battlefield ?? []).filter((id) => g.state.cards[id]?.isToken);
    expect(tokens).toHaveLength(1);
  });

  test('replays to the same hash', () => {
    const g = crypted();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
