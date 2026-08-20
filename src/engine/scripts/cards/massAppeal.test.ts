// `Mass Appeal` — two Humans draw two; the Bears counts nothing.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { MASS_APPEAL_SCRIPT } from './massAppeal';
import { MASS_APPEAL } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function appealed(): { g: Game; mid: number } {
  const g = startedGame({
    players: 2,
    decks: [
      ['Mass Appeal', 'Aysen Bureaucrats', 'Aysen Bureaucrats', 'Grizzly Bears'],
      [],
    ],
    scripts: createRegistry([MASS_APPEAL_SCRIPT]),
  });
  const a = put(g, 'p1', 'Aysen Bureaucrats');
  const b = put(g, 'p1', 'Aysen Bureaucrats');
  expect(b).not.toBe(a);
  put(g, 'p1', 'Grizzly Bears');
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const spell = put(g, 'p1', 'Mass Appeal', 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 2 }));
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'U', amount: 1 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  const mid = (g.state.zones.hand['p1'] ?? []).length;
  settle(g);
  return { g, mid };
}

describe('Mass Appeal', () => {
  test('two Humans draw two', () => {
    const { g, mid } = appealed();
    expect((g.state.zones.hand['p1'] ?? []).length).toBe(mid + 2);
  });

  test('the suppression predicate holds (D187)', () => {
    const text = MASS_APPEAL.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, MASS_APPEAL.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(MASS_APPEAL.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const { g } = appealed();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
