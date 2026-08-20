// `Infectious Inquiry` — I draw two and pay 2; the opponent is poisoned.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { INFECTIOUS_INQUIRY_SCRIPT } from './infectiousInquiry';
import { INFECTIOUS_INQUIRY } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function inquired(): { g: Game; mid: number } {
  const g = startedGame({
    players: 2,
    decks: [['Infectious Inquiry'], ['Grizzly Bears']],
    scripts: createRegistry([INFECTIOUS_INQUIRY_SCRIPT]),
  });
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const spell = put(g, 'p1', 'Infectious Inquiry', 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 2 }));
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'B', amount: 1 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  const mid = (g.state.zones.hand['p1'] ?? []).length;
  settle(g);
  return { g, mid };
}

describe('Infectious Inquiry', () => {
  test('two cards, 2 life, and one poison counter across the table', () => {
    const { g, mid } = inquired();
    expect((g.state.zones.hand['p1'] ?? []).length).toBe(mid + 2);
    expect(g.state.players['p1']?.life).toBe(38);
    expect(g.state.players['p2']?.poison).toBe(1);
  });

  test('the suppression predicate holds (D187)', () => {
    const text = INFECTIOUS_INQUIRY.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, INFECTIOUS_INQUIRY.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(INFECTIOUS_INQUIRY.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const { g } = inquired();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
