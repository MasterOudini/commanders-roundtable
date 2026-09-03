// `Pileated Provisioner` — entering puts a +1/+1 counter on my ground
// creature; my flyer and their ground creature are refused (D289).

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { PILEATED_PROVISIONER_SCRIPT } from './pileatedProvisioner';
import { advanceUntil, deps, must, put, startedGame } from '../../testing/harness';
import { derive } from '../../derive';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const CARD = 'Pileated Provisioner';
const HAWK = 'Vampire Nighthawk';
const BEARS = 'Grizzly Bears';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function entered(): { g: Game; bears: InstanceId; myHawk: InstanceId; theirs: InstanceId } {
  const g = startedGame({ players: 2, decks: [[CARD, BEARS, HAWK], [BEARS]], scripts: createRegistry([PILEATED_PROVISIONER_SCRIPT]) });
  const bears = put(g, 'p1', BEARS);
  const myHawk = put(g, 'p1', HAWK);
  const theirs = put(g, 'p2', BEARS);
  settle(g);
  const bird = put(g, 'p1', CARD, 'graveyard');
  settle(g);
  must(g.submit({ t: 'ManualMoveCard', player: 'p1', card: bird, to: { kind: 'battlefield', player: 'p1' } }));
  expect(g.state.priority.awaiting?.kind).toBe('chooseTargets');
  return { g, bears, myHawk, theirs };
}

describe('Pileated Provisioner', () => {
  test('my ground creature gets the counter', () => {
    const { g, bears } = entered();
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: bears }] }));
    settle(g);
    const d = deps(createRegistry([PILEATED_PROVISIONER_SCRIPT]));
    expect(derive(g.state, d.oracle, d.scripts, bears).power).toBe(3);
  });

  test('my flyer and their ground creature are refused (D289)', () => {
    const { g, myHawk, theirs } = entered();
    expect(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: myHawk }] }).ok).toBe(false);
    expect(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: theirs }] }).ok).toBe(false);
  });

  test('replays to the same hash', () => {
    const { g, bears } = entered();
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: bears }] }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
