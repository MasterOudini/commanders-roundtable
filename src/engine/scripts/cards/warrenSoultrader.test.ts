// `Warren Soultrader` — BOTH halves of a mana-free cost are charged: 1 life
// and another creature, for one Treasure.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { WARREN_SOULTRADER_SCRIPT } from './warrenSoultrader';
import { advanceUntil, battlefieldOf, must, nameOf, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const TRADER = 'Warren Soultrader';
const FODDER = 'Grizzly Bears';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function treasures(g: Game): number {
  return battlefieldOf(g, 'p1').filter((id) => nameOf(g, id) === 'Treasure').length;
}

function board(): { g: Game; trader: InstanceId; fodder: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [[TRADER, FODDER], []],
    scripts: createRegistry([WARREN_SOULTRADER_SCRIPT]),
  });
  const trader = put(g, 'p1', TRADER);
  const fodder = put(g, 'p1', FODDER);
  settle(g);
  return { g, trader, fodder };
}

describe('Warren Soultrader', () => {
  test('1 life and another creature buy exactly one Treasure', () => {
    const { g, trader, fodder } = board();
    must(
      g.submit({
        t: 'ActivateAbility',
        player: 'p1',
        card: trader,
        abilityIndex: 0,
        sacrifice: fodder,
      }),
    );
    settle(g);
    expect(g.state.cards[fodder]?.zone.kind).toBe('graveyard');
    expect(g.state.players['p1']?.life).toBe(39);
    expect(treasures(g)).toBe(1);
    expect(g.state.cards[trader]?.zone.kind).toBe('battlefield');
  });

  test('it may NOT eat itself — the cost says "another"', () => {
    const { g, trader } = board();
    const res = g.submit({
      t: 'ActivateAbility',
      player: 'p1',
      card: trader,
      abilityIndex: 0,
      sacrifice: trader,
    });
    expect(res.ok).toBe(false);
  });

  test('replays to the same hash', () => {
    const { g, trader, fodder } = board();
    must(
      g.submit({
        t: 'ActivateAbility',
        player: 'p1',
        card: trader,
        abilityIndex: 0,
        sacrifice: fodder,
      }),
    );
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
