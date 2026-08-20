// `Cruel Bargain` — four draws and HALF the life, rounded up.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { CRUEL_BARGAIN_SCRIPT } from './cruelBargain';
import { CRUEL_BARGAIN } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function bargained(): { g: Game; before: number } {
  const g = startedGame({
    players: 2,
    decks: [['Cruel Bargain'], ['Grizzly Bears']],
    scripts: createRegistry([CRUEL_BARGAIN_SCRIPT]),
  });
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const spell = put(g, 'p1', 'Cruel Bargain', 'hand');
  const before = (g.state.zones.hand['p1'] ?? []).length - 1;
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'B', amount: 3 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  settle(g);
  return { g, before };
}

describe('Cruel Bargain', () => {
  test('four drawn and 40 halves to 20', () => {
    const { g, before } = bargained();
    expect((g.state.zones.hand['p1'] ?? []).length).toBe(before + 4);
    expect(g.state.players['p1']?.life).toBe(20);
  });

  test('the suppression predicate holds (D187)', () => {
    const text = CRUEL_BARGAIN.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, CRUEL_BARGAIN.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(CRUEL_BARGAIN.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const { g } = bargained();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
