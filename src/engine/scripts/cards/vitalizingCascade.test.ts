// `Vitalizing Cascade` — X plus 3, so X=0 still gains 3. The floor is the
// branch worth pinning.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { VITALIZING_CASCADE_SCRIPT } from './vitalizingCascade';
import { VITALIZING_CASCADE } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

const SPELL = 'Vitalizing Cascade';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function cast(x: number): Game {
  const g = startedGame({
    players: 2,
    decks: [[SPELL], []],
    scripts: createRegistry([VITALIZING_CASCADE_SCRIPT]),
  });
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const spell = put(g, 'p1', SPELL, 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'G', amount: 4 }));
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'W', amount: 4 }));
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 8 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell, xValue: x }));
  settle(g);
  return g;
}

describe('Vitalizing Cascade', () => {
  test('X=4 gains 7', () => {
    expect(cast(4).state.players['p1']?.life).toBe(47);
  });

  test('X=0 still gains the flat 3', () => {
    expect(cast(0).state.players['p1']?.life).toBe(43);
  });

  test('the suppression predicate holds (D187)', () => {
    const text = VITALIZING_CASCADE.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, VITALIZING_CASCADE.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(VITALIZING_CASCADE.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const g = cast(2);
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
