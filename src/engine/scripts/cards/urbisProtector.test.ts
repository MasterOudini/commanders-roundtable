// `Urbis Protector` — the ETB Angel, asserted on the token's derived P/T and
// flying so a wrong pin shows up as a blank rather than passing on a count.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { derive } from '../../derive';
import { createRegistry } from '../registry';
import { URBIS_PROTECTOR_SCRIPT } from './urbisProtector';
import { ORACLE, advanceUntil, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const PROTECTOR = 'Urbis Protector';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function entered(): Game {
  const g = startedGame({
    players: 2,
    decks: [[PROTECTOR], []],
    scripts: createRegistry([URBIS_PROTECTOR_SCRIPT]),
  });
  put(g, 'p1', PROTECTOR);
  settle(g);
  return g;
}

describe('Urbis Protector', () => {
  test('one 4/4 Angel WITH FLYING arrives under its controller', () => {
    const g = entered();
    const token = g.state.zones.battlefield.find((id) => g.state.cards[id]?.isToken);
    expect(token).toBeDefined();
    const d = derive(g.state, ORACLE, g.deps.scripts, token as InstanceId);
    expect(d.power).toBe(4);
    expect(d.toughness).toBe(4);
    expect(d.keywords.has('flying')).toBe(true);
    expect(g.state.cards[token as InstanceId]?.controller).toBe('p1');
  });

  test('replays to the same hash', () => {
    const g = entered();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
