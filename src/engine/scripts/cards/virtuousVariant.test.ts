// `Virtuous Variant` — the ETB counter, with the "you control" restriction
// REFUSED at the aim.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { VIRTUOUS_VARIANT_SCRIPT } from './virtuousVariant';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const VARIANT = 'Virtuous Variant';
const BEARS = 'Grizzly Bears';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function board(): { g: Game; mine: InstanceId; theirs: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [[VARIANT, BEARS], [BEARS]],
    scripts: createRegistry([VIRTUOUS_VARIANT_SCRIPT]),
  });
  const mine = put(g, 'p1', BEARS);
  const theirs = put(g, 'p2', BEARS);
  settle(g);
  put(g, 'p1', VARIANT);
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
  return { g, mine, theirs };
}

describe('Virtuous Variant', () => {
  test('a creature I control gets the +1/+1 counter', () => {
    const { g, mine } = board();
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: mine }] }));
    settle(g);
    expect(g.state.cards[mine]?.counters['+1/+1']).toBe(1);
  });

  test("an OPPONENT's creature is refused at the aim", () => {
    const { g, theirs } = board();
    const res = g.submit({
      t: 'ChooseTargets',
      player: 'p1',
      targets: [{ kind: 'card', id: theirs }],
    });
    expect(res.ok).toBe(false);
  });

  test('replays to the same hash', () => {
    const { g, mine } = board();
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: mine }] }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
