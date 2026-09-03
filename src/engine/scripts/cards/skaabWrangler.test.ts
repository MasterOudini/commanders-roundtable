// `Skaab Wrangler` — three untapped creatures (itself among them) tap to
// tap the opponent's creature.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { SKAAB_WRANGLER_SCRIPT } from './skaabWrangler';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const WRANGLER = 'Skaab Wrangler';
const BEARS = 'Grizzly Bears';
const NIGHTHAWK = 'Vampire Nighthawk';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function placed(): { g: Game; wrangler: InstanceId; a: InstanceId; b: InstanceId; theirs: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [[WRANGLER, BEARS, NIGHTHAWK], [BEARS]],
    scripts: createRegistry([SKAAB_WRANGLER_SCRIPT]),
  });
  const theirs = put(g, 'p2', BEARS);
  const a = put(g, 'p1', BEARS);
  const b = put(g, 'p1', NIGHTHAWK);
  const wrangler = put(g, 'p1', WRANGLER);
  settle(g);
  return { g, wrangler, a, b, theirs };
}

describe('Skaab Wrangler (tap three creatures)', () => {
  test('three creatures tap; their bear is tapped', () => {
    const { g, wrangler, a, b, theirs } = placed();
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: wrangler, abilityIndex: 0, tap: [wrangler, a, b] }));
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: theirs }] }));
    settle(g);
    expect(g.state.cards[theirs]?.tapped).toBe(true);
    for (const id of [wrangler, a, b]) expect(g.state.cards[id]?.tapped).toBe(true);
  });

  test('replays to the same hash', () => {
    const { g, wrangler, a, b, theirs } = placed();
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: wrangler, abilityIndex: 0, tap: [wrangler, a, b] }));
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: theirs }] }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
