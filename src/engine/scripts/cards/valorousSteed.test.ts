// `Valorous Steed` — the ETB Knight, asserted on the token's derived
// vigilance so a wrong pin shows as a missing keyword.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { derive } from '../../derive';
import { createRegistry } from '../registry';
import { VALOROUS_STEED_SCRIPT } from './valorousSteed';
import { ORACLE, advanceUntil, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const STEED = 'Valorous Steed';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function entered(): Game {
  const g = startedGame({
    players: 2,
    decks: [[STEED], []],
    scripts: createRegistry([VALOROUS_STEED_SCRIPT]),
  });
  put(g, 'p1', STEED);
  settle(g);
  return g;
}

describe('Valorous Steed', () => {
  test('one 2/2 Knight WITH VIGILANCE arrives under its controller', () => {
    const g = entered();
    const token = g.state.zones.battlefield.find((id) => g.state.cards[id]?.isToken);
    expect(token).toBeDefined();
    const d = derive(g.state, ORACLE, g.deps.scripts, token as InstanceId);
    expect(d.power).toBe(2);
    expect(d.toughness).toBe(2);
    expect(d.keywords.has('vigilance')).toBe(true);
    expect(g.state.cards[token as InstanceId]?.controller).toBe('p1');
  });

  test('replays to the same hash', () => {
    const g = entered();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
