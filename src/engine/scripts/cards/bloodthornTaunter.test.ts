// `Bloodthorn Taunter` — the D139 floor on the haste grant: the 6/6 is
// legal, the 2/2 refused at the aim.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { derive } from '../../derive';
import { createRegistry } from '../registry';
import { BLOODTHORN_TAUNTER_SCRIPT } from './bloodthornTaunter';
import { ORACLE, advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function armed(): { g: Game; taunter: InstanceId; maw: InstanceId; bears: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [['Bloodthorn Taunter', 'Colossal Dreadmaw', 'Grizzly Bears'], ['Grizzly Bears']],
    scripts: createRegistry([BLOODTHORN_TAUNTER_SCRIPT]),
  });
  const taunter = put(g, 'p1', 'Bloodthorn Taunter');
  const maw = put(g, 'p1', 'Colossal Dreadmaw');
  const bears = put(g, 'p1', 'Grizzly Bears');
  settle(g);
  advanceUntil(
    g,
    (s) => s.turn.turnNumber >= 3 && s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain',
    60_000,
  );
  must(g.submit({ t: 'ActivateAbility', player: 'p1', card: taunter, abilityIndex: 0 }));
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
  return { g, taunter, maw, bears };
}

describe('Bloodthorn Taunter', () => {
  test('the 6/6 gains derived haste', () => {
    const { g, maw } = armed();
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: maw }] }));
    settle(g);
    expect(derive(g.state, ORACLE, g.deps.scripts, maw).keywords.has('haste')).toBe(true);
  });

  test('the 2/2 is REFUSED — the power floor is enforced at the aim', () => {
    const { g, bears } = armed();
    const verdict = g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: bears }] });
    expect(verdict.ok).toBe(false);
  });

  test('replays to the same hash', () => {
    const { g, maw } = armed();
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: maw }] }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
