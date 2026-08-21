// `Reki, the History of Kamigawa` — a legendary cast pays a card; a
// plain Bears pays nothing.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { REKI_THE_HISTORY_OF_KAMIGAWA_SCRIPT } from './rekiTheHistoryOfKamigawa';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function chronicled(): Game {
  const g = startedGame({
    players: 2,
    decks: [['Reki, the History of Kamigawa', 'Krenko, Mob Boss', 'Grizzly Bears'], []],
    scripts: createRegistry([REKI_THE_HISTORY_OF_KAMIGAWA_SCRIPT]),
  });
  put(g, 'p1', 'Reki, the History of Kamigawa');
  settle(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 20_000);
  return g;
}

describe('Reki, the History of Kamigawa', () => {
  test('a legendary cast draws; a plain creature does not', () => {
    const g = chronicled();
    const bears = put(g, 'p1', 'Grizzly Bears', 'hand');
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'G', amount: 2 }));
    const logAt = g.log.length;
    must(g.submit({ t: 'CastSpell', player: 'p1', card: bears }));
    settle(g);
    const drewFromBears = g.log
      .slice(logAt)
      .flatMap((e) => (e.body.t === 'CardsMoved' ? e.body.moves : []))
      .filter((m) => m.from.kind === 'library' && m.to.kind === 'hand').length;
    expect(drewFromBears).toBe(0);
    const krenko = put(g, 'p1', 'Krenko, Mob Boss', 'hand');
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'R', amount: 2 }));
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 2 }));
    const logAt2 = g.log.length;
    must(g.submit({ t: 'CastSpell', player: 'p1', card: krenko }));
    settle(g);
    const drewFromKrenko = g.log
      .slice(logAt2)
      .flatMap((e) => (e.body.t === 'CardsMoved' ? e.body.moves : []))
      .filter((m) => m.from.kind === 'library' && m.to.kind === 'hand').length;
    expect(drewFromKrenko).toBe(1);
  });

  test('replays to the same hash', () => {
    const g = chronicled();
    const krenko = put(g, 'p1', 'Krenko, Mob Boss', 'hand');
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'R', amount: 2 }));
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 2 }));
    must(g.submit({ t: 'CastSpell', player: 'p1', card: krenko }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
