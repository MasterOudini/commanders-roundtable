// `Zoo Escapees` — LEAVING the battlefield makes a Mutagen, whatever the
// destination: exile proves it is not merely a dies trigger.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { ZOO_ESCAPEES_SCRIPT } from './zooEscapees';
import { advanceUntil, battlefieldOf, must, nameOf, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

const ESCAPEES = 'Zoo Escapees';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function mutagens(g: Game): number {
  return battlefieldOf(g, 'p1').filter((id) => nameOf(g, id) === 'Mutagen').length;
}

function left(to: 'graveyard' | 'exile'): Game {
  const g = startedGame({
    players: 2,
    decks: [[ESCAPEES], []],
    scripts: createRegistry([ZOO_ESCAPEES_SCRIPT]),
  });
  const id = put(g, 'p1', ESCAPEES);
  settle(g);
  must(g.submit({ t: 'ManualMoveCard', player: 'p1', card: id, to: { kind: to, player: 'p1' } }));
  settle(g);
  return g;
}

describe('Zoo Escapees', () => {
  test('dying makes a Mutagen', () => {
    expect(mutagens(left('graveyard'))).toBe(1);
  });

  test('being EXILED makes one too — it is leaves-the-battlefield, not dies', () => {
    expect(mutagens(left('exile'))).toBe(1);
  });

  test('replays to the same hash', () => {
    const g = left('exile');
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
