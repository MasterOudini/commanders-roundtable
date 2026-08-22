// `Teyo's Lightshield` — the targeted ETB +1/+1 COUNTER: it SURVIVES cleanup,
// which is what tells it apart from Tenth District Guard's pump.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { TEYOS_LIGHTSHIELD_SCRIPT } from './teyosLightshield';
import { derive } from '../../derive';
import { advanceUntil, must, put, startedGame, ORACLE } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const SHIELD = "Teyo's Lightshield";
const BEARS = 'Grizzly Bears';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function entered(): { g: Game; bears: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [[SHIELD, BEARS], []],
    scripts: createRegistry([TEYOS_LIGHTSHIELD_SCRIPT]),
  });
  const bears = put(g, 'p1', BEARS);
  settle(g);
  put(g, 'p1', SHIELD);
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
  must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: bears }] }));
  settle(g);
  return { g, bears };
}

describe("Teyo's Lightshield", () => {
  test('the target carries a +1/+1 counter and is a 3/3', () => {
    const { g, bears } = entered();
    expect(g.state.cards[bears]?.counters['+1/+1']).toBe(1);
    expect(derive(g.state, ORACLE, g.deps.scripts, bears).power).toBe(3);
  });

  test('a COUNTER survives cleanup — the pump does not', () => {
    const { g, bears } = entered();
    const turn = g.state.turn.turnNumber;
    advanceUntil(g, (s) => s.turn.turnNumber > turn, 60_000);
    expect(derive(g.state, ORACLE, g.deps.scripts, bears).power).toBe(3);
  });

  test('replays to the same hash', () => {
    const { g } = entered();
    advanceUntil(g, (s) => s.turn.turnNumber >= 3, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
