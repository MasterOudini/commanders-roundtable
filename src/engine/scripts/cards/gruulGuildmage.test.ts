// `Gruul Guildmage` — a land paid bolts the opponent for 2; four mana pumps
// a creature +2/+2. Neither taps, so both work the turn it enters.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { GRUUL_GUILDMAGE_SCRIPT } from './gruulGuildmage';
import { advanceUntil, deps, must, put, startedGame } from '../../testing/harness';
import { derive } from '../../derive';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const MAGE = 'Gruul Guildmage';
const BEARS = 'Grizzly Bears';
const FOREST = 'Forest';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function board(): { g: Game; mage: InstanceId; forest: InstanceId; bears: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [[MAGE, FOREST, BEARS], []],
    scripts: createRegistry([GRUUL_GUILDMAGE_SCRIPT]),
  });
  const forest = put(g, 'p1', FOREST);
  const bears = put(g, 'p1', BEARS);
  const mage = put(g, 'p1', MAGE);
  settle(g);
  return { g, mage, forest, bears };
}

function pt(g: Game, id: InstanceId): { power: number | null; toughness: number | null } {
  const d = deps(createRegistry([GRUUL_GUILDMAGE_SCRIPT]));
  const got = derive(g.state, d.oracle, d.scripts, id);
  return { power: got.power, toughness: got.toughness };
}

describe('Gruul Guildmage', () => {
  test('{3}{R}, sacrifice a land: 2 damage to the opponent', () => {
    const { g, mage, forest } = board();
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'R', amount: 1 }));
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 3 }));
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: mage, abilityIndex: 0, sacrifice: forest }));
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'player', id: 'p2' }] }));
    settle(g);
    expect(g.state.players['p2']?.life).toBe(38);
    expect(g.state.cards[forest]?.zone.kind).toBe('graveyard');
  });

  test('a creature is refused as the land price', () => {
    const { g, mage, bears } = board();
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'R', amount: 1 }));
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 3 }));
    const res = g.submit({ t: 'ActivateAbility', player: 'p1', card: mage, abilityIndex: 0, sacrifice: bears });
    expect(res.ok).toBe(false);
  });

  test('{3}{G}: +2/+2', () => {
    const { g, mage, bears } = board();
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'G', amount: 1 }));
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 3 }));
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: mage, abilityIndex: 1 }));
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: bears }] }));
    settle(g);
    expect(pt(g, bears)).toEqual({ power: 4, toughness: 4 });
  });

  test('replays to the same hash', () => {
    const { g, mage, forest } = board();
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'R', amount: 1 }));
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 3 }));
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: mage, abilityIndex: 0, sacrifice: forest }));
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'player', id: 'p2' }] }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
