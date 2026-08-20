// `Case the Joint` — two draws, then each player's library TOP revealed to
// the CASTER (and to nobody else).

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { CASE_THE_JOINT_SCRIPT } from './caseTheJoint';
import { CASE_THE_JOINT } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function cased(): { g: Game; before: number } {
  const g = startedGame({
    players: 2,
    decks: [['Case the Joint'], ['Grizzly Bears']],
    scripts: createRegistry([CASE_THE_JOINT_SCRIPT]),
  });
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const spell = put(g, 'p1', 'Case the Joint', 'hand');
  const before = (g.state.zones.hand['p1'] ?? []).length - 1;
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'U', amount: 4 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  settle(g);
  return { g, before };
}

describe('Case the Joint', () => {
  test('two drawn, and BOTH library tops are revealed to the caster only', () => {
    const { g, before } = cased();
    expect((g.state.zones.hand['p1'] ?? []).length).toBe(before + 2);
    for (const pid of ['p1', 'p2'] as const) {
      const lib = g.state.zones.library[pid] ?? [];
      const top = lib[lib.length - 1];
      expect(top).toBeDefined();
      expect(g.state.cards[top as string]?.revealedTo).toContain('p1');
      expect(g.state.cards[top as string]?.revealedTo).not.toContain('p2');
    }
  });

  test('the suppression predicate holds (D187)', () => {
    const text = CASE_THE_JOINT.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, CASE_THE_JOINT.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(CASE_THE_JOINT.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const { g } = cased();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
