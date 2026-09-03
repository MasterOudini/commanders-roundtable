// `Haazda Vigilante` — the enters arm AND the attacks arm each pay a
// counter, and the power-2-or-less restriction is the spec's.
//
// ⚠️ D290: that restriction was DROPPED by the parser from the day this
// card landed — "with power 2 or less" sits AFTER "you control", and the
// controller reader returned without reading on — so the attacks arm here
// used to accept the very Bears the enters arm had grown to 3/3. The
// controller branches recurse now; the 3-power Bears is refused and a fresh
// 2/2 takes the second counter, which is what the card says.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { HAAZDA_VIGILANTE_SCRIPT } from './haazdaVigilante';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const VIGILANTE = 'Haazda Vigilante';
const BEARS = 'Grizzly Bears';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function board(): { g: Game; vigilante: InstanceId; bears: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [[VIGILANTE, BEARS, BEARS], []],
    scripts: createRegistry([HAAZDA_VIGILANTE_SCRIPT]),
  });
  const bears = put(g, 'p1', BEARS);
  settle(g);
  const vigilante = put(g, 'p1', VIGILANTE);
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
  must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: bears }] }));
  settle(g);
  return { g, vigilante, bears };
}

describe('Haazda Vigilante', () => {
  test('the enters arm pays a counter; the attacks arm refuses the 3/3 it made and pays a fresh 2/2', () => {
    const { g, vigilante, bears } = board();
    expect(g.state.cards[bears]?.counters['+1/+1']).toBe(1);
    const fresh = put(g, 'p1', BEARS);
    settle(g);
    advanceUntil(
      g,
      (s) => s.turn.turnNumber === 3 && s.priority.awaiting?.kind === 'declareAttackers',
      20_000,
    );
    must(
      g.submit({
        t: 'DeclareAttackers',
        player: 'p1',
        attackers: [{ card: vigilante, defender: { kind: 'player', id: 'p2' } }],
      }),
    );
    advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
    // D290: the Bears is a 3/3 now — "with power 2 or less" refuses it.
    expect(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: bears }] }).ok).toBe(false);
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: fresh }] }));
    settle(g);
    expect(g.state.cards[fresh]?.counters['+1/+1']).toBe(1);
    expect(g.state.cards[bears]?.counters['+1/+1']).toBe(1);
  });

  test('replays to the same hash', () => {
    const { g } = board();
    advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
