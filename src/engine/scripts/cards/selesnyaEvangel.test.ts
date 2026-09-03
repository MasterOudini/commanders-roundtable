// `Selesnya Evangel` — one mana, its own tap and my bear tapped make a
// Saproling.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { SELESNYA_EVANGEL_SCRIPT } from './selesnyaEvangel';
import { TOKEN_TABLE } from '../../../data/tokenTable';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const EVANGEL = 'Selesnya Evangel';
const BEARS = 'Grizzly Bears';
const SAPROLING = TOKEN_TABLE['Saproling|1/1|G|Creature|'];

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function saprolings(g: Game, player: string): number {
  return g.state.zones.battlefield.filter((id) => {
    const c = g.state.cards[id];
    return !!c && c.isToken && c.controller === player && c.printingId === SAPROLING?.printingId;
  }).length;
}

function ready(): { g: Game; evangel: InstanceId; bears: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [[EVANGEL, BEARS], []],
    scripts: createRegistry([SELESNYA_EVANGEL_SCRIPT]),
  });
  const bears = put(g, 'p1', BEARS);
  const evangel = put(g, 'p1', EVANGEL);
  settle(g);
  advanceUntil(g, (s) => s.turn.turnNumber >= 3 && s.priority.awaiting === null, 60_000);
  return { g, evangel, bears };
}

describe('Selesnya Evangel', () => {
  test('{1}, {T}, tap a creature: a Saproling', () => {
    const { g, evangel, bears } = ready();
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 1 }));
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: evangel, abilityIndex: 0, tap: [bears], targets: [] }));
    settle(g);
    expect(saprolings(g, 'p1')).toBe(1);
    expect(g.state.cards[bears]?.tapped).toBe(true);
    expect(g.state.cards[evangel]?.tapped).toBe(true);
  });

  test('replays to the same hash', () => {
    const { g, evangel, bears } = ready();
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 1 }));
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: evangel, abilityIndex: 0, tap: [bears], targets: [] }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
