// `Balloon Peddler` — blue mana, the tap and a discarded card give my bear
// flying until cleanup.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { BALLOON_PEDDLER_SCRIPT } from './balloonPeddler';
import { advanceUntil, deps, idsIn, must, put, startedGame } from '../../testing/harness';
import { derive } from '../../derive';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const PEDDLER = 'Balloon Peddler';
const BEARS = 'Grizzly Bears';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function keywords(g: Game, id: InstanceId): ReadonlySet<string> {
  const d = deps(createRegistry([BALLOON_PEDDLER_SCRIPT]));
  return derive(g.state, d.oracle, d.scripts, id).keywords;
}

function ready(): { g: Game; peddler: InstanceId; bears: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [[PEDDLER, BEARS], []],
    scripts: createRegistry([BALLOON_PEDDLER_SCRIPT]),
  });
  const bears = put(g, 'p1', BEARS);
  const peddler = put(g, 'p1', PEDDLER);
  settle(g);
  advanceUntil(g, (s) => s.turn.turnNumber >= 3 && s.priority.awaiting === null, 60_000);
  return { g, peddler, bears };
}

describe('Balloon Peddler', () => {
  test('{U}, {T}, discard a card: the bear flies until cleanup', () => {
    const { g, peddler, bears } = ready();
    const chosen = idsIn(g, 'p1', 'hand')[0] as InstanceId;
    expect(keywords(g, bears).has('flying')).toBe(false);
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'U', amount: 1 }));
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: peddler, abilityIndex: 0, discard: [chosen] }));
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: bears }] }));
    settle(g);
    expect(keywords(g, bears).has('flying')).toBe(true);
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 60_000);
    expect(keywords(g, bears).has('flying')).toBe(false);
  });

  test('replays to the same hash', () => {
    const { g, peddler, bears } = ready();
    const chosen = idsIn(g, 'p1', 'hand')[0] as InstanceId;
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'U', amount: 1 }));
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: peddler, abilityIndex: 0, discard: [chosen] }));
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: bears }] }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
