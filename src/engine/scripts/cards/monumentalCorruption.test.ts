// `Monumental Corruption` — two of MY artifacts: the TARGET draws 2 and
// loses 2.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { MONUMENTAL_CORRUPTION_SCRIPT } from './monumentalCorruption';
import { MONUMENTAL_CORRUPTION } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function corrupted(): { g: Game; before: number } {
  const g = startedGame({
    players: 2,
    decks: [['Monumental Corruption', 'Sol Ring', 'Hedron Archive'], []],
    scripts: createRegistry([MONUMENTAL_CORRUPTION_SCRIPT]),
  });
  put(g, 'p1', 'Sol Ring');
  put(g, 'p1', 'Hedron Archive');
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const spell = put(g, 'p1', 'Monumental Corruption', 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 3 }));
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'B', amount: 2 }));
  const before = (g.state.zones.hand['p2'] ?? []).length;
  must(
    g.submit({
      t: 'CastSpell',
      player: 'p1',
      card: spell,
      targets: [{ kind: 'player', id: 'p2' }],
    }),
  );
  settle(g);
  return { g, before };
}

describe('Monumental Corruption', () => {
  test('the target draws 2 and loses 2 off my two artifacts', () => {
    const { g, before } = corrupted();
    expect((g.state.zones.hand['p2'] ?? []).length).toBe(before + 2);
    expect(g.state.players['p2']?.life).toBe(38);
  });

  test('the suppression predicate holds (D187)', () => {
    const text = MONUMENTAL_CORRUPTION.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, MONUMENTAL_CORRUPTION.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(MONUMENTAL_CORRUPTION.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const { g } = corrupted();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
