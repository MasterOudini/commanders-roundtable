// `Rakeclaw Gargantuan` — the floor holds: a 6/6 gains first strike, a
// 2/2 is refused.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { derive } from '../../derive';
import { createRegistry } from '../registry';
import { RAKECLAW_GARGANTUAN_SCRIPT } from './rakeclawGargantuan';
import { ORACLE, advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function clawed(): { g: Game; claw: InstanceId; big: InstanceId; small: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [['Rakeclaw Gargantuan', 'Colossal Dreadmaw', 'Grizzly Bears'], []],
    scripts: createRegistry([RAKECLAW_GARGANTUAN_SCRIPT]),
  });
  const claw = put(g, 'p1', 'Rakeclaw Gargantuan');
  const big = put(g, 'p1', 'Colossal Dreadmaw');
  const small = put(g, 'p1', 'Grizzly Bears');
  settle(g);
  advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 1 }));
  return { g, claw, big, small };
}

describe('Rakeclaw Gargantuan', () => {
  test('a 6/6 gains first strike; a 2/2 is under the floor', () => {
    const { g, claw, big, small } = clawed();
    const wrong = g.submit({
      t: 'ActivateAbility',
      player: 'p1',
      card: claw,
      abilityIndex: 0,
      targets: [{ kind: 'card', id: small }],
    });
    expect(wrong.ok).toBe(false);
    must(
      g.submit({
        t: 'ActivateAbility',
        player: 'p1',
        card: claw,
        abilityIndex: 0,
        targets: [{ kind: 'card', id: big }],
      }),
    );
    settle(g);
    expect(derive(g.state, ORACLE, g.deps.scripts, big).keywords.has('firstStrike')).toBe(true);
  });

  test('replays to the same hash', () => {
    const { g, claw, big } = clawed();
    must(
      g.submit({
        t: 'ActivateAbility',
        player: 'p1',
        card: claw,
        abilityIndex: 0,
        targets: [{ kind: 'card', id: big }],
      }),
    );
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
