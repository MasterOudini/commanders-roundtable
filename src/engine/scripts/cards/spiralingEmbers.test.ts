// `Spiraling Embers` — the resolving sorcery counts itself not: the hand
// baseline is what remains AFTER the cast.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { SPIRALING_EMBERS_SCRIPT } from './spiralingEmbers';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function embered(): { g: Game; expected: number } {
  const g = startedGame({
    players: 2,
    decks: [['Spiraling Embers'], []],
    scripts: createRegistry([SPIRALING_EMBERS_SCRIPT]),
  });
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const spell = put(g, 'p1', 'Spiraling Embers', 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'R', amount: 4 }));
  const expected = (g.state.zones.hand['p1'] ?? []).length - 1;
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
  must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'player', id: 'p2' }] }));
  settle(g);
  return { g, expected };
}

describe('Spiraling Embers', () => {
  test('the damage is the post-cast hand size', () => {
    const { g, expected } = embered();
    expect(g.state.players['p2']?.life).toBe(40 - expected);
  });

  test('replays to the same hash', () => {
    const { g } = embered();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
