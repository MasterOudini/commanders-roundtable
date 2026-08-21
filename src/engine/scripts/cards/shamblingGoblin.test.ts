// `Shambling Goblin` — dying aims the -1/-1 at the opponent's creature.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { derive } from '../../derive';
import { createRegistry } from '../registry';
import { SHAMBLING_GOBLIN_SCRIPT } from './shamblingGoblin';
import { ORACLE, advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function shambled(): { g: Game; bears: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [
      ['Shambling Goblin'],
      ['Grizzly Bears'],
    ],
    scripts: createRegistry([SHAMBLING_GOBLIN_SCRIPT]),
  });
  const goblin = put(g, 'p1', 'Shambling Goblin');
  const bears = put(g, 'p2', 'Grizzly Bears');
  settle(g);
  holdEverywhere(g);
  must(
    g.submit({
      t: 'ManualMoveCard',
      player: 'p1',
      card: goblin,
      to: { kind: 'graveyard', player: 'p1' },
    }),
  );
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 60_000);
  must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: bears }] }));
  settle(g);
  return { g, bears };
}

describe('Shambling Goblin', () => {
  test('the opponent creature reads 1/1 until cleanup', () => {
    const { g, bears } = shambled();
    expect(derive(g.state, ORACLE, g.deps.scripts, bears).power).toBe(1);
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(derive(g.state, ORACLE, g.deps.scripts, bears).power).toBe(2);
  });

  test('replays to the same hash', () => {
    const { g } = shambled();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
