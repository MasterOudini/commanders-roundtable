// `Idyllic Grange` — both halves from both sides: alone it enters TAPPED and
// asks nothing; behind three other Plains it enters UNTAPPED and asks for a
// creature to grow.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { IDYLLIC_GRANGE_SCRIPT } from './idyllicGrange';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const GRANGE = 'Idyllic Grange';
const PLAINS = 'Plains';
const BEARS = 'Grizzly Bears';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function withPlains(): { g: Game; grange: InstanceId; bears: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [[GRANGE, PLAINS, BEARS], []],
    scripts: createRegistry([IDYLLIC_GRANGE_SCRIPT]),
  });
  put(g, 'p1', PLAINS);
  put(g, 'p1', PLAINS);
  put(g, 'p1', PLAINS);
  const bears = put(g, 'p1', BEARS);
  settle(g);
  const grange = put(g, 'p1', GRANGE);
  return { g, grange, bears };
}

describe('Idyllic Grange', () => {
  test('behind three other Plains it enters untapped and grows the chosen creature', () => {
    const { g, grange, bears } = withPlains();
    advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
    expect(g.state.cards[grange]?.tapped).toBe(false);
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: bears }] }));
    settle(g);
    expect(g.state.cards[bears]?.counters['+1/+1']).toBe(1);
  });

  test('alone it enters tapped and asks nothing', () => {
    const g = startedGame({
      players: 2,
      decks: [[GRANGE, BEARS], []],
      scripts: createRegistry([IDYLLIC_GRANGE_SCRIPT]),
    });
    put(g, 'p1', BEARS);
    settle(g);
    const grange = put(g, 'p1', GRANGE);
    settle(g);
    expect(g.state.cards[grange]?.tapped).toBe(true);
    expect(g.log.some((e) => e.body.t === 'CountersChanged' && e.cause.kind !== 'manual')).toBe(
      false,
    );
  });

  test('replays to the same hash', () => {
    const { g, bears } = withPlains();
    advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: bears }] }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
