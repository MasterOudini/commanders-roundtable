// `Rimefur Reindeer` — an enchantment entering asks and taps the
// opponent's creature; a creature entering asks nothing.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { RIMEFUR_REINDEER_SCRIPT } from './rimefurReindeer';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function board(): { g: Game; theirs: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [
      ['Rimefur Reindeer', 'Captive Flame', 'Grizzly Bears'],
      ['Grizzly Bears'],
    ],
    scripts: createRegistry([RIMEFUR_REINDEER_SCRIPT]),
  });
  put(g, 'p1', 'Rimefur Reindeer');
  const theirs = put(g, 'p2', 'Grizzly Bears');
  settle(g);
  holdEverywhere(g);
  return { g, theirs };
}

describe('Rimefur Reindeer', () => {
  test('a creature entering asks nothing; an enchantment asks and taps', () => {
    const { g, theirs } = board();
    // The negative first: a CREATURE entering must not raise the prompt —
    // if it did, this settle would time out on the stacked trigger.
    put(g, 'p1', 'Grizzly Bears');
    settle(g);
    expect(g.state.cards[theirs]?.tapped).toBe(false);
    put(g, 'p1', 'Captive Flame');
    advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 60_000);
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: theirs }] }));
    settle(g);
    expect(g.state.cards[theirs]?.tapped).toBe(true);
  });

  test('replays to the same hash', () => {
    const { g, theirs } = board();
    put(g, 'p1', 'Captive Flame');
    advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 60_000);
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: theirs }] }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
