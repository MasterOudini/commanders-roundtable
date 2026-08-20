// `Flame Rift` — 4 to each player, caster included.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { FLAME_RIFT_SCRIPT } from './flameRift';
import { FLAME_RIFT } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function rifted(): { g: Game } {
  const g = startedGame({
    players: 2,
    decks: [['Flame Rift'], ['Grizzly Bears']],
    scripts: createRegistry([FLAME_RIFT_SCRIPT]),
  });
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const spell = put(g, 'p1', 'Flame Rift', 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'R', amount: 2 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  settle(g);
  return { g };
}

describe('Flame Rift', () => {
  test('4 to each player, caster included', () => {
    const { g } = rifted();
    expect(g.state.players['p1']?.life).toBe(36);
    expect(g.state.players['p2']?.life).toBe(36);
  });

  test('the suppression predicate holds (D187)', () => {
    const text = FLAME_RIFT.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, FLAME_RIFT.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(FLAME_RIFT.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const { g } = rifted();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
