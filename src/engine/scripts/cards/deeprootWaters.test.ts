// `Deeproot Waters` — the Merfolk cast-watcher: a Merfolk spell pays the
// hexproof token, a bear spell pays nothing.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { DEEPROOT_WATERS_SCRIPT } from './deeprootWaters';
import { MERFOLK_TOKEN } from '../../../data/fixtures/engineCards';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

const WATERS = 'Deeproot Waters';
const MERFOLK = 'Merfolk of the Pearl Trident';
const BEARS = 'Grizzly Bears';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function merfolkTokens(g: Game): number {
  return Object.values(g.state.cards).filter(
    (c) => c.isToken && c.printingId === MERFOLK_TOKEN.scryfallId,
  ).length;
}

function game(): Game {
  const g = startedGame({
    players: 2,
    decks: [[WATERS, MERFOLK, BEARS], []],
    scripts: createRegistry([DEEPROOT_WATERS_SCRIPT]),
  });
  put(g, 'p1', WATERS);
  settle(g);
  return g;
}

describe('Deeproot Waters', () => {
  test('casting a Merfolk pays the token; casting a bear pays nothing', () => {
    const g = game();
    const fish = put(g, 'p1', MERFOLK, 'hand');
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'U', amount: 1 }));
    must(g.submit({ t: 'CastSpell', player: 'p1', card: fish }));
    settle(g);
    expect(merfolkTokens(g)).toBe(1);
    const bears = put(g, 'p1', BEARS, 'hand');
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'G', amount: 1 }));
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 1 }));
    must(g.submit({ t: 'CastSpell', player: 'p1', card: bears }));
    settle(g);
    expect(merfolkTokens(g)).toBe(1);
  });

  test('replays to the same hash', () => {
    const g = game();
    const fish = put(g, 'p1', MERFOLK, 'hand');
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'U', amount: 1 }));
    must(g.submit({ t: 'CastSpell', player: 'p1', card: fish }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
