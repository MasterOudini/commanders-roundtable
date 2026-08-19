// `Acidic Soil` — per-player land counts, simultaneous: three lands hurt
// their owner for three, the landless caster takes nothing.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { ACIDIC_SOIL_SCRIPT } from './acidicSoil';
import { ACIDIC_SOIL } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function board(): Game {
  const g = startedGame({
    players: 2,
    decks: [['Acidic Soil'], ['Mountain', 'Mountain', 'Forest']],
    scripts: createRegistry([ACIDIC_SOIL_SCRIPT]),
  });
  put(g, 'p2', 'Mountain');
  put(g, 'p2', 'Mountain');
  put(g, 'p2', 'Forest');
  settle(g);
  const spell = put(g, 'p1', 'Acidic Soil', 'hand');
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 20_000);
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'R', amount: 3 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  settle(g);
  return g;
}

describe('Acidic Soil', () => {
  test('three lands cost their controller three; the landless caster takes nothing', () => {
    const g = board();
    expect(g.state.players['p2']?.life).toBe(37);
    expect(g.state.players['p1']?.life).toBe(40);
  });

  test('the suppression predicate holds (D187)', () => {
    const text = ACIDIC_SOIL.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, ACIDIC_SOIL.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(ACIDIC_SOIL.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const g = board();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
