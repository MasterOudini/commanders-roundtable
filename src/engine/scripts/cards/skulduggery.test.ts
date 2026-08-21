// `Skulduggery` — the probed two-spec sentence: my creature up, theirs down,
// both until cleanup.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { SKULDUGGERY_SCRIPT } from './skulduggery';
import { derive } from '../../derive';
import { advanceUntil, holdEverywhere, must, put, startedGame, ORACLE } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function skulduggered(): { g: Game; mine: InstanceId; theirs: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [['Skulduggery', 'Grizzly Bears'], ['Grizzly Bears']],
    scripts: createRegistry([SKULDUGGERY_SCRIPT]),
  });
  const mine = put(g, 'p1', 'Grizzly Bears');
  const theirs = put(g, 'p2', 'Grizzly Bears');
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const spell = put(g, 'p1', 'Skulduggery', 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'B', amount: 1 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
  must(
    g.submit({
      t: 'ChooseTargets',
      player: 'p1',
      targets: [
        { kind: 'card', id: mine },
        { kind: 'card', id: theirs },
      ],
    }),
  );
  settle(g);
  return { g, mine, theirs };
}

describe('Skulduggery', () => {
  test('mine gets +1/+1 and theirs -1/-1, until cleanup', () => {
    const { g, mine, theirs } = skulduggered();
    expect(derive(g.state, ORACLE, g.deps.scripts, mine).power).toBe(3);
    expect(derive(g.state, ORACLE, g.deps.scripts, theirs).power).toBe(1);
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(derive(g.state, ORACLE, g.deps.scripts, mine).power).toBe(2);
    expect(derive(g.state, ORACLE, g.deps.scripts, theirs).power).toBe(2);
  });

  test('replays to the same hash', () => {
    const { g } = skulduggered();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
