// `Tunnel Surveyor` — the ETB Glimmer, and the token is an ENCHANTMENT
// CREATURE, which the test asserts on the DERIVED type line: a wrong pin
// would create a nameless blank the SBA bins (D133), so the type is what
// proves the printing resolved.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { derive } from '../../derive';
import { createRegistry } from '../registry';
import { TUNNEL_SURVEYOR_SCRIPT } from './tunnelSurveyor';
import { ORACLE, advanceUntil, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const SURVEYOR = 'Tunnel Surveyor';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function glimmerOf(g: Game): InstanceId | undefined {
  return g.state.zones.battlefield.find((id) => {
    const c = g.state.cards[id];
    return c?.isToken && g.deps.oracle.byPrinting(c.printingId)?.name === 'Glimmer';
  });
}

function entered(): Game {
  const g = startedGame({
    players: 2,
    decks: [[SURVEYOR], []],
    scripts: createRegistry([TUNNEL_SURVEYOR_SCRIPT]),
  });
  put(g, 'p1', SURVEYOR);
  settle(g);
  return g;
}

describe('Tunnel Surveyor', () => {
  test('entering creates one Glimmer, and it is an ENCHANTMENT CREATURE', () => {
    const g = entered();
    const glimmer = glimmerOf(g);
    expect(glimmer).toBeDefined();
    const d = derive(g.state, ORACLE, g.deps.scripts, glimmer as InstanceId);
    expect(d.typeLine.types).toContain('Creature');
    expect(d.typeLine.types).toContain('Enchantment');
    expect(d.power).toBe(1);
    expect(d.toughness).toBe(1);
    expect(g.state.cards[glimmer as InstanceId]?.controller).toBe('p1');
  });

  test('replays to the same hash', () => {
    const g = entered();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
