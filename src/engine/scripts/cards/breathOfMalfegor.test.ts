// `Breath of Malfegor` — Boltwave's shape at 5, on its own id.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { BREATH_OF_MALFEGOR_SCRIPT } from './breathOfMalfegor';
import { BREATH_OF_MALFEGOR } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function breathed(): Game {
  const g = startedGame({
    players: 2,
    decks: [['Breath of Malfegor'], ['Grizzly Bears']],
    scripts: createRegistry([BREATH_OF_MALFEGOR_SCRIPT]),
  });
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const spell = put(g, 'p1', 'Breath of Malfegor', 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'B', amount: 4 }));
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'R', amount: 1 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  settle(g);
  return g;
}

describe('Breath of Malfegor', () => {
  test('the opponent takes 5; the caster nothing', () => {
    const g = breathed();
    expect(g.state.players['p2']?.life).toBe(35);
    expect(g.state.players['p1']?.life).toBe(40);
  });

  test('the suppression predicate holds (D187)', () => {
    const text = BREATH_OF_MALFEGOR.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, BREATH_OF_MALFEGOR.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(BREATH_OF_MALFEGOR.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const g = breathed();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
