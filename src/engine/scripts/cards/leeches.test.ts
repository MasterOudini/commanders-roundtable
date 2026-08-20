// `Leeches` — three poison counters come off as 3 damage.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { LEECHES_SCRIPT } from './leeches';
import { LEECHES } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function leeched(): { g: Game } {
  const g = startedGame({
    players: 2,
    decks: [['Leeches'], ['Grizzly Bears']],
    scripts: createRegistry([LEECHES_SCRIPT]),
  });
  must(g.submit({ t: 'ManualSetPoison', player: 'p2', target: 'p2', delta: 3 }));
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const spell = put(g, 'p1', 'Leeches', 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 1 }));
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'W', amount: 2 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
  must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'player', id: 'p2' }] }));
  settle(g);
  return { g };
}

describe('Leeches', () => {
  test('the poison zeroes and the same amount lands as damage', () => {
    const { g } = leeched();
    expect(g.state.players['p2']?.poison).toBe(0);
    expect(g.state.players['p2']?.life).toBe(37);
  });

  test('the suppression predicate holds (D187)', () => {
    const text = LEECHES.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, LEECHES.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(LEECHES.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const { g } = leeched();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
