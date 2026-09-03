// `Ancestor's Prophet` — five untapped Clerics (itself among them) tap for
// 10 life; the plural "Clerics" is read back to the Cleric subtype.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { ANCESTORS_PROPHET_SCRIPT } from './ancestorsProphet';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const PROPHET = "Ancestor's Prophet";
const CLERICS = ['Arashin Cleric', 'Cathedral Sanctifier', 'Centaur Healer', 'Acolyte of Xathrid'];
const BEARS = 'Grizzly Bears';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function placed(): { g: Game; prophet: InstanceId; clerics: InstanceId[]; bears: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [[PROPHET, ...CLERICS, BEARS], []],
    scripts: createRegistry([ANCESTORS_PROPHET_SCRIPT]),
  });
  const bears = put(g, 'p1', BEARS);
  const clerics = CLERICS.map((n) => put(g, 'p1', n));
  const prophet = put(g, 'p1', PROPHET);
  settle(g);
  return { g, prophet, clerics, bears };
}

describe("Ancestor's Prophet (tap five Clerics)", () => {
  test('five Clerics tap: 10 life', () => {
    const { g, prophet, clerics } = placed();
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: prophet, abilityIndex: 0, tap: [prophet, ...clerics], targets: [] }));
    settle(g);
    expect(g.state.players['p1']?.life).toBe(50);
    for (const id of [prophet, ...clerics]) expect(g.state.cards[id]?.tapped).toBe(true);
  });

  test('a bear cannot stand in for a Cleric', () => {
    const { g, prophet, clerics, bears } = placed();
    expect(g.submit({ t: 'ActivateAbility', player: 'p1', card: prophet, abilityIndex: 0, tap: [prophet, ...clerics.slice(0, 3), bears], targets: [] }).ok).toBe(false);
    expect(g.state.players['p1']?.life).toBe(40);
  });

  test('replays to the same hash', () => {
    const { g, prophet, clerics } = placed();
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: prophet, abilityIndex: 0, tap: [prophet, ...clerics], targets: [] }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
