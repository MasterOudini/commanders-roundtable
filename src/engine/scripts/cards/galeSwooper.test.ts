// `Gale Swooper` — the targeted ETB grant: the trigger asks, the answer
// grants derived flying for the turn.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { derive } from '../../derive';
import { createRegistry } from '../registry';
import { GALE_SWOOPER_SCRIPT } from './galeSwooper';
import { ORACLE, advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function swooped(): { g: Game; bears: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [['Gale Swooper', 'Grizzly Bears'], ['Grizzly Bears']],
    scripts: createRegistry([GALE_SWOOPER_SCRIPT]),
  });
  const bears = put(g, 'p1', 'Grizzly Bears');
  settle(g);
  put(g, 'p1', 'Gale Swooper');
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
  must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: bears }] }));
  settle(g);
  return { g, bears };
}

describe('Gale Swooper', () => {
  test('the entry asks for a target and grants derived flying; cleanup ends it', () => {
    const { g, bears } = swooped();
    expect(derive(g.state, ORACLE, g.deps.scripts, bears).keywords.has('flying')).toBe(true);
    const turn = g.state.turn.turnNumber;
    advanceUntil(g, (s) => s.turn.turnNumber > turn, 60_000);
    expect(derive(g.state, ORACLE, g.deps.scripts, bears).keywords.has('flying')).toBe(false);
  });

  test('replays to the same hash', () => {
    const { g } = swooped();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
