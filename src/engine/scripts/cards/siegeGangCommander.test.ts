// `Siege-Gang Commander` — three Goblins on entry; one of them pays for 2
// damage to the opponent.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { SIEGE_GANG_COMMANDER_SCRIPT } from './siegeGangCommander';
import { TOKEN_TABLE } from '../../../data/tokenTable';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const COMMANDER = 'Siege-Gang Commander';
const GOBLIN = TOKEN_TABLE['Goblin|1/1|R|Creature|'];

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function goblinsOf(g: Game, player: string): InstanceId[] {
  return g.state.zones.battlefield.filter((id) => {
    const c = g.state.cards[id];
    return !!c && c.isToken && c.controller === player && c.printingId === GOBLIN?.printingId;
  });
}

function entered(): { g: Game; commander: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [[COMMANDER], []],
    scripts: createRegistry([SIEGE_GANG_COMMANDER_SCRIPT]),
  });
  const commander = put(g, 'p1', COMMANDER);
  settle(g);
  return { g, commander };
}

describe('Siege-Gang Commander', () => {
  test('entering makes three Goblins', () => {
    const { g } = entered();
    expect(goblinsOf(g, 'p1').length).toBe(3);
  });

  test('{1}{R}, sacrifice a Goblin: 2 to the opponent, two Goblins left', () => {
    const { g, commander } = entered();
    const [goblin] = goblinsOf(g, 'p1') as [InstanceId];
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'R', amount: 1 }));
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 1 }));
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: commander, abilityIndex: 0, sacrifice: goblin }));
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'player', id: 'p2' }] }));
    settle(g);
    expect(g.state.players['p2']?.life).toBe(38);
    expect(goblinsOf(g, 'p1').length).toBe(2);
  });

  test('replays to the same hash', () => {
    const { g, commander } = entered();
    const [goblin] = goblinsOf(g, 'p1') as [InstanceId];
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'R', amount: 1 }));
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 1 }));
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: commander, abilityIndex: 0, sacrifice: goblin }));
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'player', id: 'p2' }] }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
