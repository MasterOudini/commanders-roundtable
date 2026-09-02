// `Sweettooth Witch` — a Food on entry; two mana and that Food sold for 2
// life off the opponent.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { SWEETTOOTH_WITCH_SCRIPT } from './sweettoothWitch';
import { TOKEN_TABLE } from '../../../data/tokenTable';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const WITCH = 'Sweettooth Witch';
const FOOD = TOKEN_TABLE['Food|/||Artifact|'];

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function foods(g: Game, player: string): InstanceId[] {
  return g.state.zones.battlefield.filter((id) => {
    const c = g.state.cards[id];
    return !!c && c.isToken && c.controller === player && c.printingId === FOOD?.printingId;
  });
}

function cooked(): { g: Game; witch: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [[WITCH], []],
    scripts: createRegistry([SWEETTOOTH_WITCH_SCRIPT]),
  });
  const witch = put(g, 'p1', WITCH);
  settle(g);
  return { g, witch };
}

describe('Sweettooth Witch', () => {
  test('entering makes a Food', () => {
    const { g } = cooked();
    expect(foods(g, 'p1').length).toBe(1);
  });

  test('{2}, sacrifice the Food: the opponent loses 2', () => {
    const { g, witch } = cooked();
    const [food] = foods(g, 'p1') as [InstanceId];
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 2 }));
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: witch, abilityIndex: 0, sacrifice: food }));
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'player', id: 'p2' }] }));
    settle(g);
    expect(g.state.players['p2']?.life).toBe(38);
    expect(foods(g, 'p1').length).toBe(0);
    expect(g.state.cards[witch]?.zone.kind).toBe('battlefield');
  });

  test('replays to the same hash', () => {
    const { g, witch } = cooked();
    const [food] = foods(g, 'p1') as [InstanceId];
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 2 }));
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: witch, abilityIndex: 0, sacrifice: food }));
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'player', id: 'p2' }] }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
