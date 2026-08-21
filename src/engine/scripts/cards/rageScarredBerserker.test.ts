// `Rage-Scarred Berserker` — the entry hardens a Bears against a Wrath.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { derive } from '../../derive';
import { createRegistry } from '../registry';
import { RAGE_SCARRED_BERSERKER_SCRIPT } from './rageScarredBerserker';
import { ORACLE, advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function enraged(): { g: Game; bears: InstanceId; turn: number } {
  const g = startedGame({
    players: 2,
    decks: [['Rage-Scarred Berserker', 'Grizzly Bears'], []],
    scripts: createRegistry([RAGE_SCARRED_BERSERKER_SCRIPT]),
  });
  const bears = put(g, 'p1', 'Grizzly Bears');
  settle(g);
  holdEverywhere(g);
  put(g, 'p1', 'Rage-Scarred Berserker');
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 60_000);
  must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: bears }] }));
  settle(g);
  return { g, bears, turn: g.state.turn.turnNumber };
}

describe('Rage-Scarred Berserker', () => {
  test('the Bears reads 3/2 with indestructible until cleanup', () => {
    const { g, bears, turn } = enraged();
    const d = derive(g.state, ORACLE, g.deps.scripts, bears);
    expect(d.power).toBe(3);
    expect(d.keywords.has('indestructible')).toBe(true);
    advanceUntil(g, (s) => s.turn.turnNumber > turn, 60_000);
    const after = derive(g.state, ORACLE, g.deps.scripts, bears);
    expect(after.power).toBe(2);
    expect(after.keywords.has('indestructible')).toBe(false);
  });

  test('replays to the same hash', () => {
    const { g, turn } = enraged();
    advanceUntil(g, (s) => s.turn.turnNumber > turn, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
