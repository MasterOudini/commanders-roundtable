// `Kapsho Kitefins` — its OWN entry asks and taps (the printed self arm),
// and another creature of mine asks again.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { KAPSHO_KITEFINS_SCRIPT } from './kapshoKitefins';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const KITEFINS = 'Kapsho Kitefins';
const BEARS = 'Grizzly Bears';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function board(): { g: Game; first: InstanceId; second: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [
      [KITEFINS, BEARS],
      [BEARS],
    ],
    scripts: createRegistry([KAPSHO_KITEFINS_SCRIPT]),
  });
  const first = put(g, 'p2', BEARS);
  const second = put(g, 'p2', BEARS);
  settle(g);
  return { g, first, second };
}

describe('Kapsho Kitefins', () => {
  test('its OWN entry asks — the printed self arm — and taps the choice', () => {
    const { g, first } = board();
    put(g, 'p1', KITEFINS);
    advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: first }] }));
    settle(g);
    expect(g.state.cards[first]?.tapped).toBe(true);
  });

  test('another creature of mine entering asks again', () => {
    const { g, first, second } = board();
    put(g, 'p1', KITEFINS);
    advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: first }] }));
    settle(g);
    put(g, 'p1', BEARS);
    advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: second }] }));
    settle(g);
    expect(g.state.cards[second]?.tapped).toBe(true);
  });

  test('replays to the same hash', () => {
    const { g, first } = board();
    put(g, 'p1', KITEFINS);
    advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: first }] }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
