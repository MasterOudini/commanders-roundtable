// `Weaponize the Monsters` — {2} plus a creature buys 2 damage anywhere.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { WEAPONIZE_THE_MONSTERS_SCRIPT } from './weaponizeTheMonsters';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const ENCHANTMENT = 'Weaponize the Monsters';
const FODDER = 'Grizzly Bears';
const TITAN = 'Grave Titan'; // 6/6 — survives 2

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function board(): { g: Game; card: InstanceId; fodder: InstanceId; victim: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [[ENCHANTMENT, FODDER], [TITAN]],
    scripts: createRegistry([WEAPONIZE_THE_MONSTERS_SCRIPT]),
  });
  const victim = put(g, 'p2', TITAN);
  const card = put(g, 'p1', ENCHANTMENT);
  const fodder = put(g, 'p1', FODDER);
  settle(g);
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 4 }));
  return { g, card, fodder, victim };
}

describe('Weaponize the Monsters', () => {
  test('the creature is eaten and a player takes 2', () => {
    const { g, card, fodder } = board();
    must(
      g.submit({
        t: 'ActivateAbility',
        player: 'p1',
        card,
        abilityIndex: 0,
        sacrifice: fodder,
      }),
    );
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'player', id: 'p2' }] }));
    settle(g);
    expect(g.state.cards[fodder]?.zone.kind).toBe('graveyard');
    expect(g.state.players['p2']?.life).toBe(38);
  });

  test('the same 2 marks a creature', () => {
    const { g, card, fodder, victim } = board();
    must(
      g.submit({
        t: 'ActivateAbility',
        player: 'p1',
        card,
        abilityIndex: 0,
        sacrifice: fodder,
      }),
    );
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: victim }] }));
    settle(g);
    expect(g.state.cards[victim]?.damage).toBe(2);
  });

  test('replays to the same hash', () => {
    const { g, card, fodder } = board();
    must(
      g.submit({
        t: 'ActivateAbility',
        player: 'p1',
        card,
        abilityIndex: 0,
        sacrifice: fodder,
      }),
    );
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'player', id: 'p2' }] }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
