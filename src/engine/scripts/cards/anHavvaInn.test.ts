// `An-Havva Inn` — X+1 where X counts DERIVED green creatures, any side.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { AN_HAVVA_INN_SCRIPT } from './anHavvaInn';
import { AN_HAVVA_INN } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function cast(): Game {
  const g = startedGame({
    players: 2,
    decks: [['An-Havva Inn', 'Grizzly Bears'], ['Grizzly Bears', 'White Knight']],
    scripts: createRegistry([AN_HAVVA_INN_SCRIPT]),
  });
  put(g, 'p1', 'Grizzly Bears');
  put(g, 'p2', 'Grizzly Bears');
  put(g, 'p2', 'White Knight');
  settle(g);
  const spell = put(g, 'p1', 'An-Havva Inn', 'hand');
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 20_000);
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'G', amount: 3 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  settle(g);
  return g;
}

describe('An-Havva Inn', () => {
  test('two green creatures across BOTH sides make it gain 3; the Knight is not green', () => {
    const g = cast();
    expect(g.state.players['p1']?.life).toBe(43);
  });

  test('the suppression predicate holds (D187)', () => {
    const text = AN_HAVVA_INN.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, AN_HAVVA_INN.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(AN_HAVVA_INN.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const g = cast();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
