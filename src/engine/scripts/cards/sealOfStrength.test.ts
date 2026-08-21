// `Seal of Strength` — cracks itself for +3/+3 until cleanup.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { derive } from '../../derive';
import { createRegistry } from '../registry';
import { SEAL_OF_STRENGTH_SCRIPT } from './sealOfStrength';
import { ORACLE, advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function sealed(): { g: Game; seal: InstanceId; bears: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [['Seal of Strength', 'Grizzly Bears'], []],
    scripts: createRegistry([SEAL_OF_STRENGTH_SCRIPT]),
  });
  const seal = put(g, 'p1', 'Seal of Strength');
  const bears = put(g, 'p1', 'Grizzly Bears');
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  must(
    g.submit({
      t: 'ActivateAbility',
      player: 'p1',
      card: seal,
      abilityIndex: 0,
      targets: [{ kind: 'card', id: bears }],
    }),
  );
  settle(g);
  return { g, seal, bears };
}

describe('Seal of Strength', () => {
  test('the Seal pays itself; the target reads 5/5 until cleanup', () => {
    const { g, seal, bears } = sealed();
    expect(g.state.cards[seal]?.zone.kind).toBe('graveyard');
    expect(derive(g.state, ORACLE, g.deps.scripts, bears).power).toBe(5);
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(derive(g.state, ORACLE, g.deps.scripts, bears).power).toBe(2);
  });

  test('replays to the same hash', () => {
    const { g } = sealed();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
