// `Emmara, Soul of the Accord` — HER tap pays a lifelink Soldier; someone
// else's tap pays nothing.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { EMMARA_SOUL_OF_THE_ACCORD_SCRIPT } from './emmaraSoulOfTheAccord';
import { advanceUntil, battlefieldOf, must, nameOf, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const EMMARA = 'Emmara, Soul of the Accord';
const BEARS = 'Grizzly Bears';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function soldiers(g: Game): number {
  return battlefieldOf(g, 'p1').filter((id) => nameOf(g, id) === 'Soldier').length;
}

function board(): { g: Game; emmara: InstanceId; bears: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [[EMMARA, BEARS], []],
    scripts: createRegistry([EMMARA_SOUL_OF_THE_ACCORD_SCRIPT]),
  });
  const emmara = put(g, 'p1', EMMARA);
  const bears = put(g, 'p1', BEARS);
  settle(g);
  return { g, emmara, bears };
}

describe('Emmara, Soul of the Accord', () => {
  test('tapping HER creates the lifelink Soldier', () => {
    const { g, emmara } = board();
    must(g.submit({ t: 'ManualSetTapped', player: 'p1', cards: [emmara], tapped: true }));
    settle(g);
    expect(soldiers(g)).toBe(1);
  });

  test("tapping a DIFFERENT permanent pays nothing", () => {
    const { g, bears } = board();
    must(g.submit({ t: 'ManualSetTapped', player: 'p1', cards: [bears], tapped: true }));
    settle(g);
    expect(soldiers(g)).toBe(0);
  });

  test('untapping her pays nothing — the filter is the tap direction', () => {
    const { g, emmara } = board();
    must(g.submit({ t: 'ManualSetTapped', player: 'p1', cards: [emmara], tapped: true }));
    settle(g);
    expect(soldiers(g)).toBe(1);
    must(g.submit({ t: 'ManualSetTapped', player: 'p1', cards: [emmara], tapped: false }));
    settle(g);
    expect(soldiers(g)).toBe(1);
  });

  test('replays to the same hash', () => {
    const { g, emmara } = board();
    must(g.submit({ t: 'ManualSetTapped', player: 'p1', cards: [emmara], tapped: true }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
