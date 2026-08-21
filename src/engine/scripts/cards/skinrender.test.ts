// `Skinrender` — the targeted ETB puts three -1/-1 counters; the SBA does
// any killing.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { SKINRENDER_SCRIPT } from './skinrender';
import { derive } from '../../derive';
import { advanceUntil, holdEverywhere, must, put, startedGame, ORACLE } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function rendered(): { g: Game; titan: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [['Skinrender'], ['Grave Titan']],
    scripts: createRegistry([SKINRENDER_SCRIPT]),
  });
  const titan = put(g, 'p2', 'Grave Titan');
  settle(g);
  holdEverywhere(g);
  put(g, 'p1', 'Skinrender');
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
  must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: titan }] }));
  settle(g);
  return { g, titan };
}

describe('Skinrender', () => {
  test('the Titan carries three -1/-1 counters and derives 3/3', () => {
    const { g, titan } = rendered();
    expect(g.state.cards[titan]?.counters['-1/-1']).toBe(3);
    const d = derive(g.state, ORACLE, g.deps.scripts, titan);
    expect(d.power).toBe(3);
    expect(d.toughness).toBe(3);
  });

  test('replays to the same hash', () => {
    const { g } = rendered();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
