// `Mana Geyser` â€” the board-computed ritual: one {R} per tapped land the
// OPPONENTS control, counted at resolution. The untapped land and the
// caster's own tapped land both prove the filter from its other side.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { MANA_GEYSER_SCRIPT } from './manaGeyser';
import { MANA_GEYSER } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function board(): Game {
  const g = startedGame({
    players: 2,
    decks: [['Mana Geyser', 'Mountain'], ['Mountain', 'Mountain', 'Grizzly Bears']],
    scripts: createRegistry([MANA_GEYSER_SCRIPT]),
  });
  // Two tapped opponent lands, one untapped opponent land, one tapped OWN land.
  const a = put(g, 'p2', 'Mountain');
  const b = put(g, 'p2', 'Mountain');
  put(g, 'p2', 'Mountain');
  const mine = put(g, 'p1', 'Mountain');
  must(g.submit({ t: 'ManualSetTapped', player: 'p2', cards: [a, b], tapped: true }));
  must(g.submit({ t: 'ManualSetTapped', player: 'p1', cards: [mine], tapped: true }));
  settle(g);
  const geyser = put(g, 'p1', 'Mana Geyser', 'hand');
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 20_000);
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'R', amount: 5 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: geyser }));
  settle(g);
  return g;
}

describe('Mana Geyser', () => {
  test('adds {R} per TAPPED land the OPPONENTS control â€” two, not four', () => {
    const g = board();
    // 5 funded âˆ’ 5 paid + 2 from the Geyser.
    expect(g.state.players['p1']?.pool.R).toBe(2);
  });

  test('the suppression predicate holds (D187)', () => {
    const text = MANA_GEYSER.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, MANA_GEYSER.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(MANA_GEYSER.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const g = board();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
