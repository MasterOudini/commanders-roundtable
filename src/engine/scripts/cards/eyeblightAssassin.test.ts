// `Eyeblight Assassin` — the -1/-1 lands on an opponent's creature and
// kills a 1/1 through the SBA.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { EYEBLIGHT_ASSASSIN_SCRIPT } from './eyeblightAssassin';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const ASSASSIN = 'Eyeblight Assassin';
const SMALL = 'Devout Monk';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function entering(): { g: Game; theirs: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [[ASSASSIN], [SMALL]],
    scripts: createRegistry([EYEBLIGHT_ASSASSIN_SCRIPT]),
  });
  const theirs = put(g, 'p2', SMALL);
  settle(g);
  put(g, 'p1', ASSASSIN);
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
  return { g, theirs };
}

describe('Eyeblight Assassin', () => {
  test('the -1/-1 kills a 1/1 through the SBA', () => {
    const { g, theirs } = entering();
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: theirs }] }));
    settle(g);
    expect(g.state.cards[theirs]?.zone.kind).toBe('graveyard');
  });

  test('replays to the same hash', () => {
    const { g, theirs } = entering();
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: theirs }] }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
