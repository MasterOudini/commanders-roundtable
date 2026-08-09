// `Flowstone Overseer` — the +1/-1 kills a 1/1 through the SBA.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { FLOWSTONE_OVERSEER_SCRIPT } from './flowstoneOverseer';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const OVERSEER = 'Flowstone Overseer';
const SMALL = 'Devout Monk';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function armed(): { g: Game; overseer: InstanceId; theirs: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [[OVERSEER], [SMALL]],
    scripts: createRegistry([FLOWSTONE_OVERSEER_SCRIPT]),
  });
  const overseer = put(g, 'p1', OVERSEER);
  const theirs = put(g, 'p2', SMALL);
  settle(g);
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'R', amount: 2 }));
  return { g, overseer, theirs };
}

describe('Flowstone Overseer', () => {
  test('the +1/-1 kills a 1/1 through the SBA', () => {
    const { g, overseer, theirs } = armed();
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: overseer, abilityIndex: 0 }));
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: theirs }] }));
    settle(g);
    expect(g.state.cards[theirs]?.zone.kind).toBe('graveyard');
  });

  test('replays to the same hash', () => {
    const { g, overseer, theirs } = armed();
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: overseer, abilityIndex: 0 }));
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: theirs }] }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
