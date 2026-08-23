// `Treetop Freedom Fighters` — the ETB Ally.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { TREETOP_FREEDOM_FIGHTERS_SCRIPT } from './treetopFreedomFighters';
import { advanceUntil, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

const FIGHTERS = 'Treetop Freedom Fighters';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function allies(g: Game): number {
  return g.state.zones.battlefield.filter((id) => {
    const c = g.state.cards[id];
    return c?.isToken && g.deps.oracle.byPrinting(c.printingId)?.name === 'Ally';
  }).length;
}

function entered(): Game {
  const g = startedGame({
    players: 2,
    decks: [[FIGHTERS], []],
    scripts: createRegistry([TREETOP_FREEDOM_FIGHTERS_SCRIPT]),
  });
  put(g, 'p1', FIGHTERS);
  settle(g);
  return g;
}

describe('Treetop Freedom Fighters', () => {
  test('entering creates exactly one 1/1 Ally under its controller', () => {
    const g = entered();
    expect(allies(g)).toBe(1);
    const ally = g.state.zones.battlefield.find(
      (id) => g.state.cards[id]?.isToken && g.deps.oracle.byPrinting(g.state.cards[id]!.printingId)?.name === 'Ally',
    );
    expect(ally && g.state.cards[ally]?.controller).toBe('p1');
  });

  test('replays to the same hash', () => {
    const g = entered();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
