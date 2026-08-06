// `Etherium Spinner` — a mana-value-4 cast pays a Thopter; a two-drop does
// not.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { ETHERIUM_SPINNER_SCRIPT } from './etheriumSpinner';
import { advanceUntil, battlefieldOf, must, nameOf, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

const SPINNER = 'Etherium Spinner';
const BIG = 'Hedron Archive';
const SMALL = 'Grizzly Bears';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function thopters(g: Game): number {
  return battlefieldOf(g, 'p1').filter((id) => nameOf(g, id) === 'Thopter').length;
}

function board(): Game {
  const g = startedGame({
    players: 2,
    decks: [[SPINNER, BIG, SMALL], []],
    scripts: createRegistry([ETHERIUM_SPINNER_SCRIPT]),
  });
  put(g, 'p1', SPINNER);
  settle(g);
  return g;
}

describe('Etherium Spinner', () => {
  test('a mana-value-4 cast creates the Thopter', () => {
    const g = board();
    const archive = put(g, 'p1', BIG, 'hand');
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 4 }));
    must(g.submit({ t: 'CastSpell', player: 'p1', card: archive }));
    settle(g);
    expect(thopters(g)).toBe(1);
  });

  test('a mana-value-2 cast pays nothing', () => {
    const g = board();
    const bears = put(g, 'p1', SMALL, 'hand');
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'G', amount: 1 }));
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 1 }));
    must(g.submit({ t: 'CastSpell', player: 'p1', card: bears }));
    settle(g);
    expect(thopters(g)).toBe(0);
  });

  test('replays to the same hash', () => {
    const g = board();
    const archive = put(g, 'p1', BIG, 'hand');
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 4 }));
    must(g.submit({ t: 'CastSpell', player: 'p1', card: archive }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
