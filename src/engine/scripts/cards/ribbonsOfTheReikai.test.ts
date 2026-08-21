// `Ribbons of the Reikai` — draws one per Spirit I control, and only
// Spirits count.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { RIBBONS_OF_THE_REIKAI_SCRIPT } from './ribbonsOfTheReikai';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function cast(): { g: Game; mid: number } {
  const g = startedGame({
    players: 2,
    decks: [
      ['Ribbons of the Reikai', 'Nebelgast Herald', 'Nebelgast Herald', 'Grizzly Bears'],
      [],
    ],
    scripts: createRegistry([RIBBONS_OF_THE_REIKAI_SCRIPT]),
  });
  const a = put(g, 'p1', 'Nebelgast Herald');
  const b = put(g, 'p1', 'Nebelgast Herald');
  expect(a).not.toBe(b);
  put(g, 'p1', 'Grizzly Bears');
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const spell = put(g, 'p1', 'Ribbons of the Reikai', 'hand');
  const mid = (g.state.zones.hand['p1'] ?? []).length;
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 4 }));
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'U', amount: 1 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  settle(g);
  return { g, mid };
}

describe('Ribbons of the Reikai', () => {
  test('two Spirits draw two; the Bears do not count', () => {
    const { g, mid } = cast();
    // The spell left the hand and two draws arrived.
    expect((g.state.zones.hand['p1'] ?? []).length).toBe(mid - 1 + 2);
  });

  test('replays to the same hash', () => {
    const { g } = cast();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
