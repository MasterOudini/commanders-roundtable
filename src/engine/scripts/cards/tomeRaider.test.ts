// `Tome Raider` — the plain ETB draw behind a keyword line.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { TOME_RAIDER_SCRIPT } from './tomeRaider';
import { advanceUntil, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

const RAIDER = 'Tome Raider';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function drawn(g: Game, since: number): number {
  let n = 0;
  for (let i = since; i < g.log.length; i++) {
    const body = g.log[i]?.body;
    if (body?.t === 'DrewCards' && body.player === 'p1') n += body.cards.length;
  }
  return n;
}

function entered(): { g: Game; drew: number } {
  const g = startedGame({
    players: 2,
    decks: [[RAIDER], []],
    scripts: createRegistry([TOME_RAIDER_SCRIPT]),
  });
  const since = g.log.length;
  put(g, 'p1', RAIDER);
  settle(g);
  return { g, drew: drawn(g, since) };
}

describe('Tome Raider', () => {
  test('entering draws its controller exactly one card', () => {
    const { g, drew } = entered();
    expect(drew).toBe(1);
    expect(g.state.players.p2?.life).toBe(40);
  });

  test('replays to the same hash', () => {
    const { g } = entered();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
