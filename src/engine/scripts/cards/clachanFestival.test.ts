// `Clachan Festival` — two Kithkin on entry, one more for {4}{W}.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { CLACHAN_FESTIVAL_SCRIPT } from './clachanFestival';
import { TOKEN_TABLE } from '../../../data/tokenTable';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const FESTIVAL = 'Clachan Festival';
const KITHKIN = TOKEN_TABLE['Kithkin|1/1|GW|Creature|'];

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function kithkinOf(g: Game, player: string): number {
  return g.state.zones.battlefield.filter((id) => {
    const c = g.state.cards[id];
    return !!c && c.isToken && c.controller === player && c.printingId === KITHKIN?.printingId;
  }).length;
}

function held(): { g: Game; festival: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [[FESTIVAL], []],
    scripts: createRegistry([CLACHAN_FESTIVAL_SCRIPT]),
  });
  const festival = put(g, 'p1', FESTIVAL);
  settle(g);
  return { g, festival };
}

describe('Clachan Festival', () => {
  test('entering makes two 1/1 Kithkin', () => {
    const { g } = held();
    expect(kithkinOf(g, 'p1')).toBe(2);
    expect(kithkinOf(g, 'p2')).toBe(0);
  });

  test('{4}{W} makes one more', () => {
    const { g, festival } = held();
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'W', amount: 1 }));
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 4 }));
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: festival, abilityIndex: 0, targets: [] }));
    settle(g);
    expect(kithkinOf(g, 'p1')).toBe(3);
    expect(g.state.cards[festival]?.zone.kind).toBe('battlefield');
  });

  test('replays to the same hash', () => {
    const { g, festival } = held();
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'W', amount: 1 }));
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 4 }));
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: festival, abilityIndex: 0, targets: [] }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
