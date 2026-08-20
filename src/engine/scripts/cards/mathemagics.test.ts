// `Mathemagics` — X=2 draws 2² = 4 for the targeted player.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { MATHEMAGICS_SCRIPT } from './mathemagics';
import { MATHEMAGICS } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function mathed(): { g: Game; mid: number } {
  const g = startedGame({
    players: 2,
    decks: [['Mathemagics'], []],
    scripts: createRegistry([MATHEMAGICS_SCRIPT]),
  });
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const spell = put(g, 'p1', 'Mathemagics', 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 4 }));
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'U', amount: 2 }));
  must(
    g.submit({
      t: 'CastSpell',
      player: 'p1',
      card: spell,
      xValue: 2,
      targets: [{ kind: 'player', id: 'p1' }],
    }),
  );
  const mid = (g.state.zones.hand['p1'] ?? []).length;
  settle(g);
  return { g, mid };
}

describe('Mathemagics', () => {
  test('X=2 draws four cards', () => {
    const { g, mid } = mathed();
    expect((g.state.zones.hand['p1'] ?? []).length).toBe(mid + 4);
  });

  test('the suppression predicate holds (D187)', () => {
    const text = MATHEMAGICS.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, MATHEMAGICS.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(MATHEMAGICS.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const { g } = mathed();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
