// `Spiderwig Boggart` — the entry grants fear until cleanup.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { SPIDERWIG_BOGGART_SCRIPT } from './spiderwigBoggart';
import { derive } from '../../derive';
import { advanceUntil, holdEverywhere, must, put, startedGame, ORACLE } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function wigged(): { g: Game; bears: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [['Spiderwig Boggart', 'Grizzly Bears'], []],
    scripts: createRegistry([SPIDERWIG_BOGGART_SCRIPT]),
  });
  const bears = put(g, 'p1', 'Grizzly Bears');
  settle(g);
  holdEverywhere(g);
  put(g, 'p1', 'Spiderwig Boggart');
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
  must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: bears }] }));
  settle(g);
  return { g, bears };
}

describe('Spiderwig Boggart', () => {
  test('the Bears gains fear until cleanup', () => {
    const { g, bears } = wigged();
    expect(derive(g.state, ORACLE, g.deps.scripts, bears).keywords.has('fear')).toBe(true);
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(derive(g.state, ORACLE, g.deps.scripts, bears).keywords.has('fear')).toBe(false);
  });

  test('replays to the same hash', () => {
    const { g } = wigged();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
