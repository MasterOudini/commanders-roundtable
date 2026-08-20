// `Joyous Respite` — three lands gain me 3.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { JOYOUS_RESPITE_SCRIPT } from './joyousRespite';
import { JOYOUS_RESPITE } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function rested(): { g: Game } {
  const g = startedGame({
    players: 2,
    decks: [['Joyous Respite', 'Swamp', 'Mountain', 'Forest'], []],
    scripts: createRegistry([JOYOUS_RESPITE_SCRIPT]),
  });
  put(g, 'p1', 'Swamp');
  put(g, 'p1', 'Mountain');
  put(g, 'p1', 'Forest');
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const spell = put(g, 'p1', 'Joyous Respite', 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 3 }));
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'G', amount: 1 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  settle(g);
  return { g };
}

describe('Joyous Respite', () => {
  test('three lands gain exactly 3', () => {
    const { g } = rested();
    expect(g.state.players['p1']?.life).toBe(43);
  });

  test('the suppression predicate holds (D187)', () => {
    const text = JOYOUS_RESPITE.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, JOYOUS_RESPITE.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(JOYOUS_RESPITE.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const { g } = rested();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
