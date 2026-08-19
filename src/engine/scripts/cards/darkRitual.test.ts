// `Dark Ritual` — the first mana-adding SpellDef: {B} in, {B}{B}{B} out,
// through the same ManaAdded a land writes.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { DARK_RITUAL_SCRIPT } from './darkRitual';
import { DARK_RITUAL } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function cast(): Game {
  const g = startedGame({
    players: 2,
    decks: [['Dark Ritual'], ['Grizzly Bears']],
    scripts: createRegistry([DARK_RITUAL_SCRIPT]),
  });
  const ritual = put(g, 'p1', 'Dark Ritual', 'hand');
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 20_000);
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'B', amount: 1 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: ritual }));
  settle(g);
  return g;
}

describe('Dark Ritual', () => {
  test('one {B} in, three {B} out — the pool nets +2 black', () => {
    const g = cast();
    expect(g.state.players['p1']?.pool.B).toBe(3);
  });

  test('the suppression predicate holds (D187)', () => {
    const text = DARK_RITUAL.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, DARK_RITUAL.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(DARK_RITUAL.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const g = cast();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
