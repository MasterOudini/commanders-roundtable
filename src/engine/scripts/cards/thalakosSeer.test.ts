// `Thalakos Seer` — LEAVES is wider than dies: a bounce pays too.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { THALAKOS_SEER_SCRIPT } from './thalakosSeer';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

const SEER = 'Thalakos Seer';

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

function left(to: 'graveyard' | 'hand'): { g: Game; drew: number } {
  const g = startedGame({
    players: 2,
    decks: [[SEER], []],
    scripts: createRegistry([THALAKOS_SEER_SCRIPT]),
  });
  const seer = put(g, 'p1', SEER);
  settle(g);
  const since = g.log.length;
  must(g.submit({ t: 'ManualMoveCard', player: 'p1', card: seer, to: { kind: to, player: 'p1' } }));
  settle(g);
  return { g, drew: drawn(g, since) };
}

describe('Thalakos Seer', () => {
  test('dying draws a card', () => {
    expect(left('graveyard').drew).toBe(1);
  });

  test('a BOUNCE draws one too — the word is "leaves", not "dies"', () => {
    expect(left('hand').drew).toBe(1);
  });

  test('replays to the same hash', () => {
    const { g } = left('graveyard');
    advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
