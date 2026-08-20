// `Inspiration` — the TARGET draws two; I draw nothing.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { INSPIRATION_SCRIPT } from './inspiration';
import { INSPIRATION } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function inspired(): { g: Game; mine: number; theirs: number } {
  const g = startedGame({
    players: 2,
    decks: [['Inspiration'], ['Grizzly Bears']],
    scripts: createRegistry([INSPIRATION_SCRIPT]),
  });
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const spell = put(g, 'p1', 'Inspiration', 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 3 }));
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'U', amount: 1 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  const mine = (g.state.zones.hand['p1'] ?? []).length;
  const theirs = (g.state.zones.hand['p2'] ?? []).length;
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
  must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'player', id: 'p2' }] }));
  settle(g);
  return { g, mine, theirs };
}

describe('Inspiration', () => {
  test('the target draws two; my hand is unmoved', () => {
    const { g, mine, theirs } = inspired();
    expect((g.state.zones.hand['p2'] ?? []).length).toBe(theirs + 2);
    expect((g.state.zones.hand['p1'] ?? []).length).toBe(mine);
  });

  test('the suppression predicate holds (D187)', () => {
    const text = INSPIRATION.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, INSPIRATION.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(INSPIRATION.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const { g } = inspired();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
