// `Zuran Orb` — a land pays for 2 life, with no mana anywhere in the cost;
// a non-land is refused as the sacrifice.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { ZURAN_ORB_SCRIPT } from './zuranOrb';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const ORB = 'Zuran Orb';
const LAND = 'Forest';
const NOT_A_LAND = 'Grizzly Bears';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function board(): { g: Game; orb: InstanceId; land: InstanceId; bears: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [[ORB, LAND, NOT_A_LAND], []],
    scripts: createRegistry([ZURAN_ORB_SCRIPT]),
  });
  const orb = put(g, 'p1', ORB);
  const land = put(g, 'p1', LAND);
  const bears = put(g, 'p1', NOT_A_LAND);
  settle(g);
  return { g, orb, land, bears };
}

describe('Zuran Orb', () => {
  test('a land buys 2 life, no mana needed', () => {
    const { g, orb, land } = board();
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: orb, abilityIndex: 0, sacrifice: land }));
    settle(g);
    expect(g.state.cards[land]?.zone.kind).toBe('graveyard');
    expect(g.state.players['p1']?.life).toBe(42);
  });

  test('a creature is refused as the sacrifice', () => {
    const { g, orb, bears } = board();
    const res = g.submit({ t: 'ActivateAbility', player: 'p1', card: orb, abilityIndex: 0, sacrifice: bears });
    expect(res.ok).toBe(false);
  });

  test('replays to the same hash', () => {
    const { g, orb, land } = board();
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: orb, abilityIndex: 0, sacrifice: land }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
