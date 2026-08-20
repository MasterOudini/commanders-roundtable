// `Battle Hymn` — {R} per creature I control, straight into the pool.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { BATTLE_HYMN_SCRIPT } from './battleHymn';
import { BATTLE_HYMN } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function sung(): Game {
  const g = startedGame({
    players: 2,
    decks: [['Battle Hymn', 'Grizzly Bears', 'Llanowar Elves'], ['Grizzly Bears']],
    scripts: createRegistry([BATTLE_HYMN_SCRIPT]),
  });
  put(g, 'p1', 'Grizzly Bears');
  put(g, 'p1', 'Llanowar Elves');
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const spell = put(g, 'p1', 'Battle Hymn', 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'R', amount: 2 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  settle(g);
  return g;
}

describe('Battle Hymn', () => {
  test('two creatures put {R}{R} in the pool', () => {
    const g = sung();
    expect(g.state.players['p1']?.pool.R).toBe(2);
  });

  test('the suppression predicate holds (D187)', () => {
    const text = BATTLE_HYMN.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, BATTLE_HYMN.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(BATTLE_HYMN.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const g = sung();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
