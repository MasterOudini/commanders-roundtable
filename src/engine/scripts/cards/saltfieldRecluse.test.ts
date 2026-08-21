// `Saltfield Recluse` — the tap-debuff reads -2/-0 until cleanup.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { derive } from '../../derive';
import { createRegistry } from '../registry';
import { SALTFIELD_RECLUSE_SCRIPT } from './saltfieldRecluse';
import { ORACLE, advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function recluded(): { g: Game; maw: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [
      ['Saltfield Recluse'],
      ['Colossal Dreadmaw'],
    ],
    scripts: createRegistry([SALTFIELD_RECLUSE_SCRIPT]),
  });
  const recluse = put(g, 'p1', 'Saltfield Recluse');
  const maw = put(g, 'p2', 'Colossal Dreadmaw');
  settle(g);
  holdEverywhere(g);
  advanceUntil(
    g,
    (s) =>
      s.turn.turnNumber >= 3 &&
      s.turn.activePlayer === 'p1' &&
      s.turn.phase === 'precombatMain',
    120_000,
  );
  must(
    g.submit({
      t: 'ActivateAbility',
      player: 'p1',
      card: recluse,
      abilityIndex: 0,
      targets: [{ kind: 'card', id: maw }],
    }),
  );
  settle(g);
  return { g, maw };
}

describe('Saltfield Recluse', () => {
  test('the 6/6 reads 4/6 until cleanup', () => {
    const { g, maw } = recluded();
    expect(derive(g.state, ORACLE, g.deps.scripts, maw).power).toBe(4);
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 120_000);
    expect(derive(g.state, ORACLE, g.deps.scripts, maw).power).toBe(6);
  });

  test('replays to the same hash', () => {
    const { g } = recluded();
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 120_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
