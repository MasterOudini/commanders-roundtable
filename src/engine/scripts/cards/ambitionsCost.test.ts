// `Ambition's Cost` — three cards for three life, through THE draw rule.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { AMBITIONS_COST_SCRIPT } from './ambitionsCost';
import { AMBITION_S_COST } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function cast(): { g: Game; libBefore: number } {
  const g = startedGame({
    players: 2,
    decks: [["Ambition's Cost", 'Grizzly Bears'], ['Grizzly Bears']],
    scripts: createRegistry([AMBITIONS_COST_SCRIPT]),
  });
  const spell = put(g, 'p1', "Ambition's Cost", 'hand');
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 20_000);
  const libBefore = g.state.zones.library['p1']?.length ?? 0;
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'B', amount: 4 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  settle(g);
  return { g, libBefore };
}

describe("Ambition's Cost", () => {
  test('three cards, three life', () => {
    const { g, libBefore } = cast();
    expect(g.state.zones.library['p1']?.length).toBe(libBefore - 3);
    expect(g.state.players['p1']?.life).toBe(37);
  });

  test('the suppression predicate holds (D187)', () => {
    const text = AMBITION_S_COST.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, AMBITION_S_COST.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(AMBITION_S_COST.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const { g } = cast();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
