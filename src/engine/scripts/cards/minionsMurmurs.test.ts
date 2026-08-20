// `Minions' Murmurs` — two creatures: draw 2, lose 2.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { MINIONS_MURMURS_SCRIPT } from './minionsMurmurs';
import { MINIONS_MURMURS } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function murmured(): { g: Game; mid: number } {
  const g = startedGame({
    players: 2,
    decks: [["Minions' Murmurs", 'Grizzly Bears', 'Aysen Bureaucrats'], []],
    scripts: createRegistry([MINIONS_MURMURS_SCRIPT]),
  });
  put(g, 'p1', 'Grizzly Bears');
  put(g, 'p1', 'Aysen Bureaucrats');
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const spell = put(g, 'p1', "Minions' Murmurs", 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 2 }));
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'B', amount: 2 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  const mid = (g.state.zones.hand['p1'] ?? []).length;
  settle(g);
  return { g, mid };
}

describe("Minions' Murmurs", () => {
  test('two creatures: draw two, lose two', () => {
    const { g, mid } = murmured();
    expect((g.state.zones.hand['p1'] ?? []).length).toBe(mid + 2);
    expect(g.state.players['p1']?.life).toBe(38);
  });

  test('the suppression predicate holds (D187)', () => {
    const text = MINIONS_MURMURS.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, MINIONS_MURMURS.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(MINIONS_MURMURS.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const { g } = murmured();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
