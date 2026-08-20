// `Invincible Hymn` — my life BECOMES the library count, whichever
// direction that moves it.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { INVINCIBLE_HYMN_SCRIPT } from './invincibleHymn';
import { INVINCIBLE_HYMN } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function sung(): { g: Game; lib: number } {
  const g = startedGame({
    players: 2,
    decks: [['Invincible Hymn'], ['Grizzly Bears']],
    scripts: createRegistry([INVINCIBLE_HYMN_SCRIPT]),
  });
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const spell = put(g, 'p1', 'Invincible Hymn', 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 6 }));
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'W', amount: 2 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  const lib = (g.state.zones.library['p1'] ?? []).length;
  settle(g);
  return { g, lib };
}

describe('Invincible Hymn', () => {
  test('life equals the library count at resolution', () => {
    const { g, lib } = sung();
    expect(lib).toBeGreaterThan(0);
    expect(g.state.players['p1']?.life).toBe(lib);
  });

  test('the suppression predicate holds (D187)', () => {
    const text = INVINCIBLE_HYMN.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, INVINCIBLE_HYMN.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(INVINCIBLE_HYMN.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const { g } = sung();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
