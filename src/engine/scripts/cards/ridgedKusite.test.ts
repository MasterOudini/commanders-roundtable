// `Ridged Kusite` — two mana, the tap and a discarded card give my bear
// +1/+0 and first strike until cleanup.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { RIDGED_KUSITE_SCRIPT } from './ridgedKusite';
import { advanceUntil, deps, idsIn, must, put, startedGame } from '../../testing/harness';
import { derive } from '../../derive';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const KUSITE = 'Ridged Kusite';
const BEARS = 'Grizzly Bears';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function chars(g: Game, id: InstanceId): ReturnType<typeof derive> {
  const d = deps(createRegistry([RIDGED_KUSITE_SCRIPT]));
  return derive(g.state, d.oracle, d.scripts, id);
}

function ready(): { g: Game; kusite: InstanceId; bears: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [[KUSITE, BEARS], []],
    scripts: createRegistry([RIDGED_KUSITE_SCRIPT]),
  });
  const bears = put(g, 'p1', BEARS);
  const kusite = put(g, 'p1', KUSITE);
  settle(g);
  advanceUntil(g, (s) => s.turn.turnNumber >= 3 && s.priority.awaiting === null, 60_000);
  return { g, kusite, bears };
}

describe('Ridged Kusite', () => {
  test('{1}{B}, {T}, discard a card: +1/+0 and first strike until cleanup', () => {
    const { g, kusite, bears } = ready();
    const chosen = idsIn(g, 'p1', 'hand')[0] as InstanceId;
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'B', amount: 1 }));
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 1 }));
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: kusite, abilityIndex: 0, discard: [chosen] }));
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: bears }] }));
    settle(g);
    const got = chars(g, bears);
    expect({ power: got.power, toughness: got.toughness }).toEqual({ power: 3, toughness: 2 });
    expect(got.keywords.has('firstStrike')).toBe(true);
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 60_000);
    expect(chars(g, bears).keywords.has('firstStrike')).toBe(false);
  });

  test('replays to the same hash', () => {
    const { g, kusite, bears } = ready();
    const chosen = idsIn(g, 'p1', 'hand')[0] as InstanceId;
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'B', amount: 1 }));
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 1 }));
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: kusite, abilityIndex: 0, discard: [chosen] }));
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: bears }] }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
