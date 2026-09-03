// `Thraben Standard Bearer` — two mana, the tap and a discarded card make a
// 1/1 white Human Soldier.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { THRABEN_STANDARD_BEARER_SCRIPT } from './thrabenStandardBearer';
import { TOKEN_TABLE } from '../../../data/tokenTable';
import { advanceUntil, idsIn, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const BEARER = 'Thraben Standard Bearer';
const SOLDIER = TOKEN_TABLE['Human Soldier|1/1|W|Creature|'];

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function soldiers(g: Game, player: string): number {
  return g.state.zones.battlefield.filter((id) => {
    const c = g.state.cards[id];
    return !!c && c.isToken && c.controller === player && c.printingId === SOLDIER?.printingId;
  }).length;
}

function ready(): { g: Game; bearer: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [[BEARER], []],
    scripts: createRegistry([THRABEN_STANDARD_BEARER_SCRIPT]),
  });
  const bearer = put(g, 'p1', BEARER);
  settle(g);
  advanceUntil(g, (s) => s.turn.turnNumber >= 3 && s.priority.awaiting === null, 60_000);
  return { g, bearer };
}

describe('Thraben Standard Bearer', () => {
  test('{1}{W}, {T}, discard a card: a 1/1 Human Soldier', () => {
    const { g, bearer } = ready();
    const chosen = idsIn(g, 'p1', 'hand')[0] as InstanceId;
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'W', amount: 1 }));
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 1 }));
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: bearer, abilityIndex: 0, discard: [chosen], targets: [] }));
    settle(g);
    expect(soldiers(g, 'p1')).toBe(1);
    expect(g.state.cards[chosen]?.zone.kind).toBe('graveyard');
  });

  test('replays to the same hash', () => {
    const { g, bearer } = ready();
    const chosen = idsIn(g, 'p1', 'hand')[0] as InstanceId;
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'W', amount: 1 }));
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 1 }));
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: bearer, abilityIndex: 0, discard: [chosen], targets: [] }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
