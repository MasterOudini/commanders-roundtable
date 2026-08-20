// `Planar Despair` — the sweep scales to the caster's basic land types.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { derive } from '../../derive';
import { createRegistry } from '../registry';
import { PLANAR_DESPAIR_SCRIPT } from './planarDespair';
import { ORACLE, advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function despaired(): { g: Game; big: string; small: string } {
  const g = startedGame({
    players: 2,
    decks: [['Planar Despair'], ['Colossal Dreadmaw', 'Grizzly Bears']],
    scripts: createRegistry([PLANAR_DESPAIR_SCRIPT]),
  });
  // Domain 2: a Swamp and a Mountain from the padding.
  put(g, 'p1', 'Swamp');
  put(g, 'p1', 'Mountain');
  const big = put(g, 'p2', 'Colossal Dreadmaw');
  const small = put(g, 'p2', 'Grizzly Bears');
  settle(g);
  const spell = put(g, 'p1', 'Planar Despair', 'hand');
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 20_000);
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'B', amount: 2 }));
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 3 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  settle(g);
  return { g, big, small };
}

describe('Planar Despair', () => {
  test('domain 2 kills the 2/2 and shrinks the 6/6 to 4/4', () => {
    const { g, big, small } = despaired();
    expect(g.state.cards[small]?.zone.kind).toBe('graveyard');
    expect(g.state.cards[big]?.zone.kind).toBe('battlefield');
    const d = derive(g.state, ORACLE, g.deps.scripts, big);
    expect(d.power).toBe(4);
    expect(d.toughness).toBe(4);
  });

  test('replays to the same hash', () => {
    const { g } = despaired();
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
