// `Mutilate` — two Swamps: the 2/2 dies through the SBA, the 6/6 stands
// at 4/4.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { MUTILATE_SCRIPT } from './mutilate';
import { MUTILATE } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { derive } from '../../derive';
import { ORACLE, advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function mutilated(): { g: Game; bears: InstanceId; titan: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [['Mutilate', 'Swamp', 'Swamp', 'Grave Titan'], ['Grizzly Bears']],
    scripts: createRegistry([MUTILATE_SCRIPT]),
  });
  const a = put(g, 'p1', 'Swamp');
  const b = put(g, 'p1', 'Swamp');
  expect(b).not.toBe(a);
  const titan = put(g, 'p1', 'Grave Titan');
  const bears = put(g, 'p2', 'Grizzly Bears');
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const spell = put(g, 'p1', 'Mutilate', 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 2 }));
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'B', amount: 2 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  settle(g);
  return { g, bears, titan };
}

describe('Mutilate', () => {
  test('two Swamps kill the Bears and shave the Titan to 4/4', () => {
    const { g, bears, titan } = mutilated();
    expect(g.state.cards[bears]?.zone.kind).toBe('graveyard');
    expect(g.state.cards[titan]?.zone.kind).toBe('battlefield');
    const d = derive(g.state, ORACLE, g.deps.scripts, titan);
    expect(d.power).toBe(4);
    expect(d.toughness).toBe(4);
  });

  test('the suppression predicate holds (D187)', () => {
    const text = MUTILATE.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, MUTILATE.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(MUTILATE.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const { g } = mutilated();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
