// `Twin-Silk Spider` — the ETB Spider, asserted on the token's DERIVED reach
// so a wrong printing would show up as a missing keyword rather than passing
// on a count alone (D133's blank).

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { derive } from '../../derive';
import { createRegistry } from '../registry';
import { TWIN_SILK_SPIDER_SCRIPT } from './twinSilkSpider';
import { ORACLE, advanceUntil, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const SPIDER = 'Twin-Silk Spider';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function tokenOf(g: Game): InstanceId | undefined {
  return g.state.zones.battlefield.find((id) => g.state.cards[id]?.isToken);
}

function entered(): Game {
  const g = startedGame({
    players: 2,
    decks: [[SPIDER], []],
    scripts: createRegistry([TWIN_SILK_SPIDER_SCRIPT]),
  });
  put(g, 'p1', SPIDER);
  settle(g);
  return g;
}

describe('Twin-Silk Spider', () => {
  test('one 1/2 Spider WITH REACH arrives under its controller', () => {
    const g = entered();
    const token = tokenOf(g);
    expect(token).toBeDefined();
    const d = derive(g.state, ORACLE, g.deps.scripts, token as InstanceId);
    expect(d.power).toBe(1);
    expect(d.toughness).toBe(2);
    expect(d.keywords.has('reach')).toBe(true);
    expect(g.state.cards[token as InstanceId]?.controller).toBe('p1');
  });

  test('replays to the same hash', () => {
    const g = entered();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
