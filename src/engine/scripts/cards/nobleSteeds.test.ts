// `Noble Steeds` — the grant lands and ends at cleanup.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { NOBLE_STEEDS_SCRIPT } from './nobleSteeds';
import { derive } from '../../derive';
import { ORACLE, advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function ridden(): { g: Game; steeds: InstanceId; bears: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [['Noble Steeds', 'Grizzly Bears'], []],
    scripts: createRegistry([NOBLE_STEEDS_SCRIPT]),
  });
  const steeds = put(g, 'p1', 'Noble Steeds');
  const bears = put(g, 'p1', 'Grizzly Bears');
  settle(g);
  advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 1 }));
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'W', amount: 1 }));
  return { g, steeds, bears };
}

describe('Noble Steeds', () => {
  test('grants derived first strike until cleanup', () => {
    const { g, steeds, bears } = ridden();
    must(
      g.submit({
        t: 'ActivateAbility',
        player: 'p1',
        card: steeds,
        abilityIndex: 0,
        targets: [{ kind: 'card', id: bears }],
      }),
    );
    settle(g);
    expect(derive(g.state, ORACLE, g.deps.scripts, bears).keywords.has('firstStrike')).toBe(true);
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 60_000);
    expect(derive(g.state, ORACLE, g.deps.scripts, bears).keywords.has('firstStrike')).toBe(false);
  });

  test('replays to the same hash', () => {
    const { g, steeds, bears } = ridden();
    must(
      g.submit({
        t: 'ActivateAbility',
        player: 'p1',
        card: steeds,
        abilityIndex: 0,
        targets: [{ kind: 'card', id: bears }],
      }),
    );
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
