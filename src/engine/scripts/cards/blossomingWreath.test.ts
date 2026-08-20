// `Blossoming Wreath` — life per creature CARD in my graveyard: two
// creatures and a land pay exactly 2.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { BLOSSOMING_WREATH_SCRIPT } from './blossomingWreath';
import { BLOSSOMING_WREATH } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function wreathed(): Game {
  const g = startedGame({
    players: 2,
    decks: [['Blossoming Wreath', 'Grizzly Bears', 'Llanowar Elves', 'Mountain'], ['Grizzly Bears']],
    scripts: createRegistry([BLOSSOMING_WREATH_SCRIPT]),
  });
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  for (const name of ['Grizzly Bears', 'Llanowar Elves', 'Mountain']) {
    const id = put(g, 'p1', name, 'hand');
    must(g.submit({ t: 'ManualMoveCard', player: 'p1', card: id, to: { kind: 'graveyard', player: 'p1' } }));
  }
  const spell = put(g, 'p1', 'Blossoming Wreath', 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'G', amount: 1 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  settle(g);
  return g;
}

describe('Blossoming Wreath', () => {
  test('two creature cards + a land in the graveyard pay exactly 2', () => {
    const g = wreathed();
    expect(g.state.players['p1']?.life).toBe(42);
  });

  test('the suppression predicate holds (D187)', () => {
    const text = BLOSSOMING_WREATH.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, BLOSSOMING_WREATH.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(BLOSSOMING_WREATH.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const g = wreathed();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
