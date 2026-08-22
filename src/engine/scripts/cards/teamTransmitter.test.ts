// `Team Transmitter` — the HERO-subtype entry watcher: a Hero of mine pays,
// an ordinary creature of mine does not, and an opponent's Hero does not.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { TEAM_TRANSMITTER_SCRIPT } from './teamTransmitter';
import { advanceUntil, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

const TRANSMITTER = 'Team Transmitter';
const HERO = 'Spider-Ham, Peter Porker';
const BEARS = 'Grizzly Bears';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function entered(who: 'p1' | 'p2', name: string): Game {
  const g = startedGame({
    players: 2,
    decks: [[TRANSMITTER, HERO, BEARS], [HERO]],
    scripts: createRegistry([TEAM_TRANSMITTER_SCRIPT]),
  });
  put(g, 'p1', TRANSMITTER);
  settle(g);
  put(g, who, name);
  settle(g);
  return g;
}

describe('Team Transmitter', () => {
  test('MY Hero entering gains 1 life', () => {
    expect(entered('p1', HERO).state.players.p1?.life).toBe(41);
  });

  test('my NON-Hero creature gains nothing — the filter is the subtype', () => {
    expect(entered('p1', BEARS).state.players.p1?.life).toBe(40);
  });

  test("an OPPONENT's Hero gains nothing", () => {
    expect(entered('p2', HERO).state.players.p1?.life).toBe(40);
  });

  test('replays to the same hash', () => {
    const g = entered('p1', HERO);
    advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
