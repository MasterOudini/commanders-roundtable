// `Marsh Gas` — -2/-0 zeroes the powers; nothing dies.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { derive } from '../../derive';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { MARSH_GAS_SCRIPT } from './marshGas';
import { MARSH_GAS } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { ORACLE, advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function gassed(): { g: Game; bears: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [['Marsh Gas'], ['Grizzly Bears']],
    scripts: createRegistry([MARSH_GAS_SCRIPT]),
  });
  const bears = put(g, 'p2', 'Grizzly Bears');
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const spell = put(g, 'p1', 'Marsh Gas', 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'B', amount: 1 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  settle(g);
  return { g, bears };
}

describe('Marsh Gas', () => {
  test('the 2/2 reads 0/2 and survives', () => {
    const { g, bears } = gassed();
    const d = derive(g.state, ORACLE, g.deps.scripts, bears);
    expect(d.power).toBe(0);
    expect(d.toughness).toBe(2);
    expect(g.state.cards[bears]?.zone.kind).toBe('battlefield');
  });

  test('the suppression predicate holds (D187)', () => {
    const text = MARSH_GAS.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, MARSH_GAS.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(MARSH_GAS.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const { g } = gassed();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
