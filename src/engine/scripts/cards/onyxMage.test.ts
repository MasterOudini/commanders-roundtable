// `Onyx Mage` — the grant is derived deathtouch until cleanup.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { ONYX_MAGE_SCRIPT } from './onyxMage';
import { derive } from '../../derive';
import { ORACLE, advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function maged(): { g: Game; mage: InstanceId; bears: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [['Onyx Mage', 'Grizzly Bears'], []],
    scripts: createRegistry([ONYX_MAGE_SCRIPT]),
  });
  const mage = put(g, 'p1', 'Onyx Mage');
  const bears = put(g, 'p1', 'Grizzly Bears');
  settle(g);
  advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 1 }));
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'B', amount: 1 }));
  return { g, mage, bears };
}

describe('Onyx Mage', () => {
  test('grants derived deathtouch until cleanup', () => {
    const { g, mage, bears } = maged();
    must(
      g.submit({
        t: 'ActivateAbility',
        player: 'p1',
        card: mage,
        abilityIndex: 0,
        targets: [{ kind: 'card', id: bears }],
      }),
    );
    settle(g);
    expect(derive(g.state, ORACLE, g.deps.scripts, bears).keywords.has('deathtouch')).toBe(true);
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 60_000);
    expect(derive(g.state, ORACLE, g.deps.scripts, bears).keywords.has('deathtouch')).toBe(false);
  });

  test('replays to the same hash', () => {
    const { g, mage, bears } = maged();
    must(
      g.submit({
        t: 'ActivateAbility',
        player: 'p1',
        card: mage,
        abilityIndex: 0,
        targets: [{ kind: 'card', id: bears }],
      }),
    );
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
