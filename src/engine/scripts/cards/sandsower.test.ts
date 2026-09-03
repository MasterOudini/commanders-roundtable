// `Sandsower` — three untapped creatures (itself among them) tap to tap the
// opponent's creature.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { SANDSOWER_SCRIPT } from './sandsower';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const SANDSOWER = 'Sandsower';
const BEARS = 'Grizzly Bears';
const NIGHTHAWK = 'Vampire Nighthawk';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function placed(): { g: Game; sandsower: InstanceId; a: InstanceId; b: InstanceId; theirs: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [[SANDSOWER, BEARS, NIGHTHAWK], [BEARS]],
    scripts: createRegistry([SANDSOWER_SCRIPT]),
  });
  const theirs = put(g, 'p2', BEARS);
  const a = put(g, 'p1', BEARS);
  const b = put(g, 'p1', NIGHTHAWK);
  const sandsower = put(g, 'p1', SANDSOWER);
  settle(g);
  return { g, sandsower, a, b, theirs };
}

describe('Sandsower (tap three creatures)', () => {
  test('three creatures tap; their bear is tapped', () => {
    const { g, sandsower, a, b, theirs } = placed();
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: sandsower, abilityIndex: 0, tap: [sandsower, a, b] }));
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: theirs }] }));
    settle(g);
    expect(g.state.cards[theirs]?.tapped).toBe(true);
    for (const id of [sandsower, a, b]) expect(g.state.cards[id]?.tapped).toBe(true);
  });

  test('replays to the same hash', () => {
    const { g, sandsower, a, b, theirs } = placed();
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: sandsower, abilityIndex: 0, tap: [sandsower, a, b] }));
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: theirs }] }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
