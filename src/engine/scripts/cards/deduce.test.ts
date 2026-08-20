// `Deduce` — one card drawn, one Clue on the battlefield.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { DEDUCE_SCRIPT } from './deduce';
import { DEDUCE } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function deduced(): { g: Game; mine: number } {
  const g = startedGame({
    players: 2,
    decks: [['Deduce'], ['Grizzly Bears']],
    scripts: createRegistry([DEDUCE_SCRIPT]),
  });
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const spell = put(g, 'p1', 'Deduce', 'hand');
  const mine = (g.state.zones.hand['p1'] ?? []).length - 1;
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'U', amount: 2 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  settle(g);
  return { g, mine };
}

describe('Deduce', () => {
  test('draws one and leaves one Clue', () => {
    const { g, mine } = deduced();
    expect((g.state.zones.hand['p1'] ?? []).length).toBe(mine + 1);
    const clues = g.state.zones.battlefield.filter((id) => {
      const card = g.state.cards[id];
      return card?.controller === 'p1' && card.isToken &&
        g.deps.oracle.byPrinting(card.printingId)?.name === 'Clue';
    });
    expect(clues).toHaveLength(1);
  });

  test('the suppression predicate holds (D187)', () => {
    const text = DEDUCE.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, DEDUCE.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(DEDUCE.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const { g } = deduced();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
