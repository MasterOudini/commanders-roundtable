// `Dangerous Wager` — the caster's whole hand goes, exactly two come back.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { DANGEROUS_WAGER_SCRIPT } from './dangerousWager';
import { DANGEROUS_WAGER } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function wagered(): { g: Game; grave: number } {
  const g = startedGame({
    players: 2,
    decks: [['Dangerous Wager'], ['Grizzly Bears']],
    scripts: createRegistry([DANGEROUS_WAGER_SCRIPT]),
  });
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const spell = put(g, 'p1', 'Dangerous Wager', 'hand');
  const grave = (g.state.zones.graveyard['p1'] ?? []).length;
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'R', amount: 2 }));
  const held = (g.state.zones.hand['p1'] ?? []).length - 1;
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  settle(g);
  return { g, grave: grave + held + 1 };
}

describe('Dangerous Wager', () => {
  test('the hand is discarded whole; exactly two come back', () => {
    const { g, grave } = wagered();
    expect((g.state.zones.hand['p1'] ?? []).length).toBe(2);
    expect((g.state.zones.graveyard['p1'] ?? []).length).toBe(grave);
  });

  test('the suppression predicate holds (D187)', () => {
    const text = DANGEROUS_WAGER.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, DANGEROUS_WAGER.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(DANGEROUS_WAGER.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const { g } = wagered();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
