// `Jund Battlemage` — {B} and the tap drain a player for 1; {G} and the tap
// make a Saproling.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { JUND_BATTLEMAGE_SCRIPT } from './jundBattlemage';
import { TOKEN_TABLE } from '../../../data/tokenTable';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const MAGE = 'Jund Battlemage';
const SAPROLING = TOKEN_TABLE['Saproling|1/1|G|Creature|'];

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function saprolingsOf(g: Game, player: string): number {
  return g.state.zones.battlefield.filter((id) => {
    const c = g.state.cards[id];
    return !!c && c.isToken && c.controller === player && c.printingId === SAPROLING?.printingId;
  }).length;
}

function board(): { g: Game; mage: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [[MAGE], []],
    scripts: createRegistry([JUND_BATTLEMAGE_SCRIPT]),
  });
  const mage = put(g, 'p1', MAGE);
  settle(g);
  advanceUntil(g, (s) => s.turn.turnNumber >= 3 && s.priority.awaiting === null, 60_000);
  return { g, mage };
}

describe('Jund Battlemage', () => {
  test('{B}, {T}: the opponent loses 1 life', () => {
    const { g, mage } = board();
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'B', amount: 1 }));
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: mage, abilityIndex: 0 }));
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'player', id: 'p2' }] }));
    settle(g);
    expect(g.state.players['p2']?.life).toBe(39);
    expect(g.state.cards[mage]?.tapped).toBe(true);
  });

  test('{G}, {T}: a 1/1 Saproling', () => {
    const { g, mage } = board();
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'G', amount: 1 }));
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: mage, abilityIndex: 1, targets: [] }));
    settle(g);
    expect(saprolingsOf(g, 'p1')).toBe(1);
    expect(g.state.cards[mage]?.tapped).toBe(true);
  });

  test('replays to the same hash', () => {
    const { g, mage } = board();
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'G', amount: 1 }));
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: mage, abilityIndex: 1, targets: [] }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
