// `Crustacean Commando` — the ETB Mutagen: a predefined artifact whose
// ability is its own (D132), pinned by printing.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { CRUSTACEAN_COMMANDO_SCRIPT } from './crustaceanCommando';
import { MUTAGEN_TOKEN } from '../../../data/fixtures/engineCards';
import { advanceUntil, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

const COMMANDO = 'Crustacean Commando';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function game(): Game {
  return startedGame({
    players: 2,
    decks: [[COMMANDO], []],
    scripts: createRegistry([CRUSTACEAN_COMMANDO_SCRIPT]),
  });
}

describe('Crustacean Commando', () => {
  test('entering creates the Mutagen, by its exact printing', () => {
    const g = game();
    put(g, 'p1', COMMANDO);
    settle(g);
    const tokens = Object.values(g.state.cards).filter((c) => c.isToken);
    expect(tokens).toHaveLength(1);
    expect(tokens[0]?.printingId).toBe(MUTAGEN_TOKEN.scryfallId);
    expect(tokens[0]?.zone.kind).toBe('battlefield');
  });

  test('replays to the same hash', () => {
    const g = game();
    put(g, 'p1', COMMANDO);
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
