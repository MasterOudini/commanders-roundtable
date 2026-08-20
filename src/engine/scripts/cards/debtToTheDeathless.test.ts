// `Debt to the Deathless` — X = 2: the opponent loses 4 and the caster
// gains the total actually lost.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { DEBT_TO_THE_DEATHLESS_SCRIPT } from './debtToTheDeathless';
import { DEBT_TO_THE_DEATHLESS } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function collected(): { g: Game } {
  const g = startedGame({
    players: 2,
    decks: [['Debt to the Deathless'], ['Grizzly Bears']],
    scripts: createRegistry([DEBT_TO_THE_DEATHLESS_SCRIPT]),
  });
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const spell = put(g, 'p1', 'Debt to the Deathless', 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'W', amount: 3 }));
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'B', amount: 3 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell, xValue: 2 }));
  settle(g);
  return { g };
}

describe('Debt to the Deathless', () => {
  test('X = 2: the opponent loses 4, the caster gains 4', () => {
    const { g } = collected();
    expect(g.state.players['p2']?.life).toBe(36);
    expect(g.state.players['p1']?.life).toBe(44);
  });

  test('the suppression predicate holds (D187)', () => {
    const text = DEBT_TO_THE_DEATHLESS.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, DEBT_TO_THE_DEATHLESS.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(DEBT_TO_THE_DEATHLESS.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const { g } = collected();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
