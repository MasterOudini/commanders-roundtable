// `Luminarch Aspirant` — my combat asks and grows the chosen creature.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { LUMINARCH_ASPIRANT_SCRIPT } from './luminarchAspirant';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const ASPIRANT = 'Luminarch Aspirant';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function answered(): { g: Game; aspirant: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [[ASPIRANT], []],
    scripts: createRegistry([LUMINARCH_ASPIRANT_SCRIPT]),
  });
  const aspirant = put(g, 'p1', ASPIRANT);
  settle(g);
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
  // The prompt is MY beginning of combat asking where the counter goes.
  expect(g.state.turn.activePlayer).toBe('p1');
  must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: aspirant }] }));
  settle(g);
  return { g, aspirant };
}

describe('Luminarch Aspirant', () => {
  test('my combat puts a +1/+1 counter on the chosen creature', () => {
    const { g, aspirant } = answered();
    expect(g.state.cards[aspirant]?.counters['+1/+1']).toBe(1);
  });

  test('replays to the same hash', () => {
    const { g } = answered();
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
