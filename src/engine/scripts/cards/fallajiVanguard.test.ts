// `Fallaji Vanguard` — its OWN entry asks (self-inclusive), and another
// creature's entry asks again.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { FALLAJI_VANGUARD_SCRIPT } from './fallajiVanguard';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const VANGUARD = 'Fallaji Vanguard';
const BEARS = 'Grizzly Bears';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

describe('Fallaji Vanguard', () => {
  test('its own entry asks, and the +2/+0 lands; a second entry asks again', () => {
    const g = startedGame({
      players: 2,
      decks: [[VANGUARD, BEARS], []],
      scripts: createRegistry([FALLAJI_VANGUARD_SCRIPT]),
    });
    const vanguard = put(g, 'p1', VANGUARD) as InstanceId;
    advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: vanguard }] }));
    settle(g);
    expect(
      g.log.filter((e) => e.body.t === 'PtModifiedUntilEndOfTurn' && e.body.card === vanguard),
    ).toHaveLength(1);
    const bears = put(g, 'p1', BEARS) as InstanceId;
    advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: bears }] }));
    settle(g);
    expect(
      g.log.filter((e) => e.body.t === 'PtModifiedUntilEndOfTurn' && e.body.card === bears),
    ).toHaveLength(1);
  });

  test('replays to the same hash', () => {
    const g = startedGame({
      players: 2,
      decks: [[VANGUARD, BEARS], []],
      scripts: createRegistry([FALLAJI_VANGUARD_SCRIPT]),
    });
    const vanguard = put(g, 'p1', VANGUARD) as InstanceId;
    advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: vanguard }] }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
