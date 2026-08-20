// `Fateful Showdown` — one hand count serves all three clauses: the burn,
// the whole-hand discard, and the equal redraw.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { FATEFUL_SHOWDOWN_SCRIPT } from './fatefulShowdown';
import { FATEFUL_SHOWDOWN } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function showdown(): { g: Game; held: number; grave: number } {
  const g = startedGame({
    players: 2,
    decks: [['Fateful Showdown'], ['Grizzly Bears']],
    scripts: createRegistry([FATEFUL_SHOWDOWN_SCRIPT]),
  });
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const spell = put(g, 'p1', 'Fateful Showdown', 'hand');
  const held = (g.state.zones.hand['p1'] ?? []).length - 1;
  const grave = (g.state.zones.graveyard['p1'] ?? []).length;
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'R', amount: 4 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
  must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'player', id: 'p2' }] }));
  settle(g);
  return { g, held, grave };
}

describe('Fateful Showdown', () => {
  test('the burn equals the hand, the hand is discarded whole, and the redraw matches', () => {
    const { g, held, grave } = showdown();
    expect(g.state.players['p2']?.life).toBe(40 - held);
    expect((g.state.zones.hand['p1'] ?? []).length).toBe(held);
    expect((g.state.zones.graveyard['p1'] ?? []).length).toBe(grave + held + 1);
  });

  test('the suppression predicate holds (D187)', () => {
    const text = FATEFUL_SHOWDOWN.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, FATEFUL_SHOWDOWN.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(FATEFUL_SHOWDOWN.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const { g } = showdown();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
