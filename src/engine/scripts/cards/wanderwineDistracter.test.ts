// `Wanderwine Distracter` — the tap shrinks an OPPONENT's creature by 3
// power; my own creature is refused at the aim.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { WANDERWINE_DISTRACTER_SCRIPT } from './wanderwineDistracter';
import { advanceUntil, deps, must, put, startedGame } from '../../testing/harness';
import { derive } from '../../derive';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const DISTRACTER = 'Wanderwine Distracter';
const BEARS = 'Grizzly Bears'; // 2/2

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function tapped(): { g: Game; theirs: InstanceId; mine: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [[DISTRACTER, BEARS], [BEARS]],
    scripts: createRegistry([WANDERWINE_DISTRACTER_SCRIPT]),
  });
  const theirs = put(g, 'p2', BEARS);
  const mine = put(g, 'p1', BEARS);
  const distracter = put(g, 'p1', DISTRACTER);
  settle(g);
  must(g.submit({ t: 'ManualSetTapped', player: 'p1', cards: [distracter], tapped: true }));
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
  return { g, theirs, mine };
}

// ⚠️ Derived P/T is `number | null` — a non-creature has none.
function pt(g: Game, id: InstanceId): { power: number | null; toughness: number | null } {
  const d = deps(createRegistry([WANDERWINE_DISTRACTER_SCRIPT]));
  const got = derive(g.state, d.oracle, d.scripts, id);
  return { power: got.power, toughness: got.toughness };
}

describe('Wanderwine Distracter', () => {
  test("an opponent's 2/2 becomes -1/2 — power only, and it does NOT die", () => {
    const { g, theirs } = tapped();
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: theirs }] }));
    settle(g);
    expect(pt(g, theirs)).toEqual({ power: -1, toughness: 2 });
    expect(g.state.cards[theirs]?.zone.kind).toBe('battlefield');
  });

  test('MY creature is refused at the aim', () => {
    const { g, mine } = tapped();
    const res = g.submit({
      t: 'ChooseTargets',
      player: 'p1',
      targets: [{ kind: 'card', id: mine }],
    });
    expect(res.ok).toBe(false);
  });

  test('replays to the same hash', () => {
    const { g, theirs } = tapped();
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: theirs }] }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
