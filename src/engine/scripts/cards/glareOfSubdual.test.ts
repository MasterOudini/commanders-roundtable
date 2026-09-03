// `Glare of Subdual` — tapping my untapped creature taps the target
// creature; my creature is tapped in the cost batch.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { GLARE_OF_SUBDUAL_SCRIPT } from './glareOfSubdual';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const GLARE = 'Glare of Subdual';
const BEARS = 'Grizzly Bears';
const NIGHTHAWK = 'Vampire Nighthawk';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function placed(): { g: Game; glare: InstanceId; mine: InstanceId; theirs: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [[GLARE, BEARS], [NIGHTHAWK]],
    scripts: createRegistry([GLARE_OF_SUBDUAL_SCRIPT]),
  });
  const mine = put(g, 'p1', BEARS);
  const theirs = put(g, 'p2', NIGHTHAWK);
  const glare = put(g, 'p1', GLARE);
  settle(g);
  return { g, glare, mine, theirs };
}

describe('Glare of Subdual', () => {
  test('my bear taps to tap their Nighthawk', () => {
    const { g, glare, mine, theirs } = placed();
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: glare, abilityIndex: 0, tap: [mine] }));
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: theirs }] }));
    settle(g);
    expect(g.state.cards[mine]?.tapped).toBe(true);
    expect(g.state.cards[theirs]?.tapped).toBe(true);
  });

  test('a tapped bear cannot pay again', () => {
    const { g, glare, mine, theirs } = placed();
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: glare, abilityIndex: 0, tap: [mine] }));
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: theirs }] }));
    settle(g);
    const res = g.submit({ t: 'ActivateAbility', player: 'p1', card: glare, abilityIndex: 0, tap: [mine] });
    expect(res.ok).toBe(false);
  });

  test('replays to the same hash', () => {
    const { g, glare, mine, theirs } = placed();
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: glare, abilityIndex: 0, tap: [mine] }));
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: theirs }] }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
