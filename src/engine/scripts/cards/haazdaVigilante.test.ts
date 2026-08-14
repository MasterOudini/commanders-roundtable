// `Haazda Vigilante` — the enters arm AND the attacks arm each pay a
// counter, and the power-2-or-less restriction is the spec's.

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
    decks: [[VIGILANTE, BEARS], []],
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
  test('the enters arm pays a counter, and the attacks arm pays another', () => {
    const { g, vigilante, bears } = board();
    expect(g.state.cards[bears]?.counters['+1/+1']).toBe(1);
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
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: bears }] }));
    settle(g);
    expect(g.state.cards[bears]?.counters['+1/+1']).toBe(2);
  });

  test('replays to the same hash', () => {
    const { g } = board();
    advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
