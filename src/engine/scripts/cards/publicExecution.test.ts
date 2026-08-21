// `Public Execution` — the victim dies, its stablemates flinch, and my
// own creature is neither a legal victim nor debuffed.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { derive } from '../../derive';
import { createRegistry } from '../registry';
import { PUBLIC_EXECUTION_SCRIPT } from './publicExecution';
import { ORACLE, advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function executed(): { g: Game; victim: string; witness: string; mine: string } {
  const g = startedGame({
    players: 2,
    decks: [['Public Execution', 'Grizzly Bears'], ['Grizzly Bears', 'Colossal Dreadmaw']],
    scripts: createRegistry([PUBLIC_EXECUTION_SCRIPT]),
  });
  const victim = put(g, 'p2', 'Grizzly Bears');
  const witness = put(g, 'p2', 'Colossal Dreadmaw');
  const mine = put(g, 'p1', 'Grizzly Bears');
  settle(g);
  const spell = put(g, 'p1', 'Public Execution', 'hand');
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 20_000);
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'B', amount: 1 }));
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 5 }));
  const wrong = g.submit({
    t: 'CastSpell',
    player: 'p1',
    card: spell,
    targets: [{ kind: 'card', id: mine }],
  });
  expect(wrong.ok).toBe(false);
  must(
    g.submit({ t: 'CastSpell', player: 'p1', card: spell, targets: [{ kind: 'card', id: victim }] }),
  );
  settle(g);
  return { g, victim, witness, mine };
}

describe('Public Execution', () => {
  test('kills the opponent creature and debuffs its stablemate; mine untouched', () => {
    const { g, victim, witness, mine } = executed();
    expect(g.state.cards[victim]?.zone.kind).toBe('graveyard');
    expect(derive(g.state, ORACLE, g.deps.scripts, witness).power).toBe(4);
    expect(derive(g.state, ORACLE, g.deps.scripts, mine).power).toBe(2);
  });

  test('replays to the same hash', () => {
    const { g } = executed();
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
