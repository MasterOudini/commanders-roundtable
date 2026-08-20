// `Combat Professor` — MY begin-combat asks and the grant lands until
// cleanup.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { COMBAT_PROFESSOR_SCRIPT } from './combatProfessor';
import { derive } from '../../derive';
import { ORACLE, advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function granted(): { g: Game; bears: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [['Combat Professor', 'Grizzly Bears'], ['Grizzly Bears']],
    scripts: createRegistry([COMBAT_PROFESSOR_SCRIPT]),
  });
  put(g, 'p1', 'Combat Professor');
  const bears = put(g, 'p1', 'Grizzly Bears');
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 60_000);
  must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: bears }] }));
  settle(g);
  return { g, bears };
}

describe('Combat Professor', () => {
  test('the grant is a 3/2 with derived vigilance', () => {
    const { g, bears } = granted();
    const d = derive(g.state, ORACLE, g.deps.scripts, bears);
    expect(d.power).toBe(3);
    expect(d.keywords.has('vigilance')).toBe(true);
  });

  test('replays to the same hash', () => {
    const { g } = granted();
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
