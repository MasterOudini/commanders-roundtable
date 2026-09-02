// `Guardian of Cloverdell` — three Kithkin Soldiers on entry; {G} and one of
// them is a life; the Treefolk itself is refused as the Kithkin price.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { GUARDIAN_OF_CLOVERDELL_SCRIPT } from './guardianOfCloverdell';
import { TOKEN_TABLE } from '../../../data/tokenTable';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const GUARDIAN = 'Guardian of Cloverdell';
const SOLDIER = TOKEN_TABLE['Kithkin Soldier|1/1|W|Creature|'];

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function soldiersOf(g: Game, player: string): InstanceId[] {
  return g.state.zones.battlefield.filter((id) => {
    const c = g.state.cards[id];
    return !!c && c.isToken && c.controller === player && c.printingId === SOLDIER?.printingId;
  });
}

function planted(): { g: Game; guardian: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [[GUARDIAN], []],
    scripts: createRegistry([GUARDIAN_OF_CLOVERDELL_SCRIPT]),
  });
  const guardian = put(g, 'p1', GUARDIAN);
  settle(g);
  return { g, guardian };
}

describe('Guardian of Cloverdell', () => {
  test('entering makes three 1/1 Kithkin Soldiers', () => {
    const { g } = planted();
    expect(soldiersOf(g, 'p1').length).toBe(3);
    expect(soldiersOf(g, 'p2').length).toBe(0);
  });

  test('{G}, sacrifice a Kithkin: 1 life, one Soldier fewer', () => {
    const { g, guardian } = planted();
    const [soldier] = soldiersOf(g, 'p1') as [InstanceId];
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'G', amount: 1 }));
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: guardian, abilityIndex: 0, sacrifice: soldier }));
    settle(g);
    expect(g.state.players['p1']?.life).toBe(41);
    expect(soldiersOf(g, 'p1').length).toBe(2);
    expect(g.state.cards[guardian]?.zone.kind).toBe('battlefield');
  });

  test('the Treefolk is refused as the Kithkin price', () => {
    const { g, guardian } = planted();
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'G', amount: 1 }));
    const res = g.submit({ t: 'ActivateAbility', player: 'p1', card: guardian, abilityIndex: 0, sacrifice: guardian });
    expect(res.ok).toBe(false);
  });

  test('replays to the same hash', () => {
    const { g, guardian } = planted();
    const [soldier] = soldiersOf(g, 'p1') as [InstanceId];
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'G', amount: 1 }));
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: guardian, abilityIndex: 0, sacrifice: soldier }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
