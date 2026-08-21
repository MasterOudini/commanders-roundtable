// `Stroke of Genius` — the TARGET draws X, not the caster.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { STROKE_OF_GENIUS_SCRIPT } from './strokeOfGenius';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function stroked(): { g: Game; mine: number; theirs: number } {
  const g = startedGame({
    players: 2,
    decks: [['Stroke of Genius'], []],
    scripts: createRegistry([STROKE_OF_GENIUS_SCRIPT]),
  });
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const spell = put(g, 'p1', 'Stroke of Genius', 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'U', amount: 6 }));
  const mine = (g.state.zones.hand['p1'] ?? []).length;
  const theirs = (g.state.zones.hand['p2'] ?? []).length;
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell, xValue: 3 }));
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
  must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'player', id: 'p2' }] }));
  settle(g);
  return { g, mine, theirs };
}

describe('Stroke of Genius', () => {
  test('p2 draws three; the caster only loses the spell', () => {
    const { g, mine, theirs } = stroked();
    expect((g.state.zones.hand['p2'] ?? []).length).toBe(theirs + 3);
    expect((g.state.zones.hand['p1'] ?? []).length).toBe(mine - 1);
  });

  test('replays to the same hash', () => {
    const { g } = stroked();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
