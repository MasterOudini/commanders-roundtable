// `Vedalken Mesmerist` — the self-filtered attack trigger with a target, and
// the "an opponent controls" restriction refusing my own creature.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { derive } from '../../derive';
import { createRegistry } from '../registry';
import { VEDALKEN_MESMERIST_SCRIPT } from './vedalkenMesmerist';
import { ORACLE, advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const MESMERIST = 'Vedalken Mesmerist';
const BEARS = 'Grizzly Bears';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function swung(who: 'mesmerist' | 'bears'): { g: Game; mine: InstanceId; theirs: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [[MESMERIST, BEARS], [BEARS]],
    scripts: createRegistry([VEDALKEN_MESMERIST_SCRIPT]),
  });
  const mesmerist = put(g, 'p1', MESMERIST);
  const mine = put(g, 'p1', BEARS);
  const theirs = put(g, 'p2', BEARS);
  settle(g);
  holdEverywhere(g);
  advanceUntil(
    g,
    (s) =>
      s.turn.turnNumber >= 3 &&
      s.turn.activePlayer === 'p1' &&
      s.priority.awaiting?.kind === 'declareAttackers',
    120_000,
  );
  must(
    g.submit({
      t: 'DeclareAttackers',
      player: 'p1',
      attackers: [
        {
          card: who === 'mesmerist' ? mesmerist : mine,
          defender: { kind: 'player', id: 'p2' },
        },
      ],
    }),
  );
  return { g, mine, theirs };
}

describe('Vedalken Mesmerist', () => {
  test("its own attack debuffs an opponent's creature", () => {
    const { g, theirs } = swung('mesmerist');
    advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: theirs }] }));
    settle(g);
    expect(derive(g.state, ORACLE, g.deps.scripts, theirs).power).toBe(0);
    expect(derive(g.state, ORACLE, g.deps.scripts, theirs).toughness).toBe(2);
  });

  test('MY OWN creature is refused as the target', () => {
    const { g, mine } = swung('mesmerist');
    advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
    const res = g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: mine }] });
    expect(res.ok).toBe(false);
  });

  test('another creature attacking alone asks nothing', () => {
    const { g } = swung('bears');
    settle(g);
    expect(g.state.priority.awaiting?.kind).not.toBe('chooseTargets');
  });

  test('replays to the same hash', () => {
    const { g, theirs } = swung('mesmerist');
    advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: theirs }] }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 120_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
