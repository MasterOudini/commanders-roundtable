// `Dawnhart Geist` — the enchantment-cast gain: an enchantment pays 2, a
// bear pays nothing.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { DAWNHART_GEIST_SCRIPT } from './dawnhartGeist';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

const GEIST = 'Dawnhart Geist';
const MANTRA = "Ajani's Mantra";
const BEARS = 'Grizzly Bears';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function game(): Game {
  const g = startedGame({
    players: 2,
    decks: [[GEIST, MANTRA, BEARS], []],
    scripts: createRegistry([DAWNHART_GEIST_SCRIPT]),
  });
  put(g, 'p1', GEIST);
  settle(g);
  return g;
}

describe('Dawnhart Geist', () => {
  test('an enchantment cast pays 2; a bear cast pays nothing', () => {
    const g = game();
    const mantra = put(g, 'p1', MANTRA, 'hand');
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'W', amount: 1 }));
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 1 }));
    const lifeBefore = g.state.players['p1']?.life ?? 0;
    must(g.submit({ t: 'CastSpell', player: 'p1', card: mantra }));
    settle(g);
    expect(g.state.players['p1']?.life).toBe(lifeBefore + 2);
    const bears = put(g, 'p1', BEARS, 'hand');
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'G', amount: 1 }));
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 1 }));
    must(g.submit({ t: 'CastSpell', player: 'p1', card: bears }));
    settle(g);
    expect(g.state.players['p1']?.life).toBe(lifeBefore + 2);
  });

  test('replays to the same hash', () => {
    const g = game();
    const mantra = put(g, 'p1', MANTRA, 'hand');
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'W', amount: 1 }));
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 1 }));
    must(g.submit({ t: 'CastSpell', player: 'p1', card: mantra }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
