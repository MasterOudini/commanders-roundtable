// `Golgari Guildmage` — a creature paid returns a creature card from my
// graveyard to my hand; five mana puts a +1/+1 counter on a creature.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { GOLGARI_GUILDMAGE_SCRIPT } from './golgariGuildmage';
import { advanceUntil, deps, must, put, startedGame } from '../../testing/harness';
import { derive } from '../../derive';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const MAGE = 'Golgari Guildmage';
const BEARS = 'Grizzly Bears';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function board(): { g: Game; mage: InstanceId; dead: InstanceId; fodder: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [[MAGE, BEARS, BEARS], []],
    scripts: createRegistry([GOLGARI_GUILDMAGE_SCRIPT]),
  });
  const dead = put(g, 'p1', BEARS, 'graveyard');
  const fodder = put(g, 'p1', BEARS);
  const mage = put(g, 'p1', MAGE);
  settle(g);
  return { g, mage, dead, fodder };
}

function pt(g: Game, id: InstanceId): { power: number | null; toughness: number | null } {
  const d = deps(createRegistry([GOLGARI_GUILDMAGE_SCRIPT]));
  const got = derive(g.state, d.oracle, d.scripts, id);
  return { power: got.power, toughness: got.toughness };
}

describe('Golgari Guildmage', () => {
  test('{4}{B}, sacrifice a creature: the graveyard creature returns to my hand', () => {
    const { g, mage, dead, fodder } = board();
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'B', amount: 1 }));
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 4 }));
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: mage, abilityIndex: 0, sacrifice: fodder }));
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: dead }] }));
    settle(g);
    expect(g.state.cards[dead]?.zone).toEqual({ kind: 'hand', player: 'p1' });
    expect(g.state.cards[fodder]?.zone.kind).toBe('graveyard');
  });

  test('{4}{G}: a +1/+1 counter', () => {
    const { g, mage, fodder } = board();
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'G', amount: 1 }));
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 4 }));
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: mage, abilityIndex: 1 }));
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: fodder }] }));
    settle(g);
    expect(pt(g, fodder)).toEqual({ power: 3, toughness: 3 });
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(pt(g, fodder)).toEqual({ power: 3, toughness: 3 });
  });

  test('replays to the same hash', () => {
    const { g, mage, fodder } = board();
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'G', amount: 1 }));
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 4 }));
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: mage, abilityIndex: 1 }));
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: fodder }] }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
