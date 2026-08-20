// `Invigorating Falls` — creature cards in EVERY graveyard pay me; the
// artifact card pays nothing.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { INVIGORATING_FALLS_SCRIPT } from './invigoratingFalls';
import { INVIGORATING_FALLS } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function refreshed(): { g: Game } {
  const g = startedGame({
    players: 2,
    decks: [['Invigorating Falls', 'Grizzly Bears', 'Sol Ring'], ['Elvish Herder']],
    scripts: createRegistry([INVIGORATING_FALLS_SCRIPT]),
  });
  put(g, 'p1', 'Grizzly Bears', 'graveyard');
  put(g, 'p1', 'Sol Ring', 'graveyard');
  put(g, 'p2', 'Elvish Herder', 'graveyard');
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const spell = put(g, 'p1', 'Invigorating Falls', 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 2 }));
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'G', amount: 2 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  settle(g);
  return { g };
}

describe('Invigorating Falls', () => {
  test('two dead creatures across BOTH graveyards gain me 2; the Ring counts nothing', () => {
    const { g } = refreshed();
    expect(g.state.players['p1']?.life).toBe(42);
  });

  test('the suppression predicate holds (D187)', () => {
    const text = INVIGORATING_FALLS.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, INVIGORATING_FALLS.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(INVIGORATING_FALLS.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const { g } = refreshed();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
