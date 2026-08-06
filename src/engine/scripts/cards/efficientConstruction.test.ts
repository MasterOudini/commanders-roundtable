// `Efficient Construction` — an artifact cast pays a Thopter; a creature
// cast does not.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { EFFICIENT_CONSTRUCTION_SCRIPT } from './efficientConstruction';
import { advanceUntil, battlefieldOf, must, nameOf, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

const CONSTRUCTION = 'Efficient Construction';
const ARTIFACT = 'Hedron Archive';
const BEARS = 'Grizzly Bears';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function thopters(g: Game): number {
  return battlefieldOf(g, 'p1').filter((id) => nameOf(g, id) === 'Thopter').length;
}

function board(): Game {
  const g = startedGame({
    players: 2,
    decks: [[CONSTRUCTION, ARTIFACT, BEARS], []],
    scripts: createRegistry([EFFICIENT_CONSTRUCTION_SCRIPT]),
  });
  put(g, 'p1', CONSTRUCTION);
  settle(g);
  return g;
}

describe('Efficient Construction', () => {
  test('an artifact cast creates the Thopter', () => {
    const g = board();
    const archive = put(g, 'p1', ARTIFACT, 'hand');
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 4 }));
    must(g.submit({ t: 'CastSpell', player: 'p1', card: archive }));
    settle(g);
    expect(thopters(g)).toBe(1);
  });

  test('a creature cast pays nothing', () => {
    const g = board();
    const bears = put(g, 'p1', BEARS, 'hand');
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'G', amount: 1 }));
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 1 }));
    must(g.submit({ t: 'CastSpell', player: 'p1', card: bears }));
    settle(g);
    expect(thopters(g)).toBe(0);
  });

  test('replays to the same hash', () => {
    const g = board();
    const archive = put(g, 'p1', ARTIFACT, 'hand');
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 4 }));
    must(g.submit({ t: 'CastSpell', player: 'p1', card: archive }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
