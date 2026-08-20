// `Giant's Ire` — 4 to the target player either way; the draw only behind
// a Giant on my board.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { GIANTS_IRE_SCRIPT } from './giantsIre';
import { GIANT_S_IRE } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function angered(giant: boolean): { g: Game; mid: number } {
  const g = startedGame({
    players: 2,
    decks: [["Giant's Ire", 'Bulwark Giant'], ['Grizzly Bears']],
    scripts: createRegistry([GIANTS_IRE_SCRIPT]),
  });
  if (giant) put(g, 'p1', 'Bulwark Giant');
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const spell = put(g, 'p1', "Giant's Ire", 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 3 }));
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'R', amount: 1 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  const mid = (g.state.zones.hand['p1'] ?? []).length;
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
  must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'player', id: 'p2' }] }));
  settle(g);
  return { g, mid };
}

describe("Giant's Ire", () => {
  test('no Giant: 4 damage and no card', () => {
    const { g, mid } = angered(false);
    expect(g.state.players['p2']?.life).toBe(36);
    expect((g.state.zones.hand['p1'] ?? []).length).toBe(mid);
  });

  test('a Giant Soldier on my board: 4 damage and the draw', () => {
    const { g, mid } = angered(true);
    expect(g.state.players['p2']?.life).toBe(36);
    expect((g.state.zones.hand['p1'] ?? []).length).toBe(mid + 1);
  });

  test('the suppression predicate holds (D187)', () => {
    const text = GIANT_S_IRE.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, GIANT_S_IRE.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(GIANT_S_IRE.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const { g } = angered(true);
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
