// `Beacon Behemoth` — the D139 numeric FLOOR on the activated grant: the
// 6/6 gains vigilance, the 2/2 is refused at the aim.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { derive } from '../../derive';
import { createRegistry } from '../registry';
import { BEACON_BEHEMOTH_SCRIPT } from './beaconBehemoth';
import { ORACLE, advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function armed(): { g: Game; behemoth: InstanceId; maw: InstanceId; bears: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [['Beacon Behemoth', 'Colossal Dreadmaw', 'Grizzly Bears'], ['Grizzly Bears']],
    scripts: createRegistry([BEACON_BEHEMOTH_SCRIPT]),
  });
  const behemoth = put(g, 'p1', 'Beacon Behemoth');
  const maw = put(g, 'p1', 'Colossal Dreadmaw');
  const bears = put(g, 'p1', 'Grizzly Bears');
  settle(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'G', amount: 1 }));
  must(g.submit({ t: 'ActivateAbility', player: 'p1', card: behemoth, abilityIndex: 0 }));
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
  return { g, behemoth, maw, bears };
}

describe('Beacon Behemoth', () => {
  test('the 6/6 gains derived vigilance', () => {
    const { g, maw } = armed();
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: maw }] }));
    settle(g);
    expect(derive(g.state, ORACLE, g.deps.scripts, maw).keywords.has('vigilance')).toBe(true);
  });

  test('the 2/2 is REFUSED — power 5 or greater is enforced at the aim', () => {
    const { g, bears } = armed();
    const verdict = g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: bears }] });
    expect(verdict.ok).toBe(false);
  });

  test('replays to the same hash', () => {
    const { g, maw } = armed();
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: maw }] }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
