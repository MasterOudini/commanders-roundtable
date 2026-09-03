// `Stern Constable` — the tap and a discarded card of my choice tap the
// opponent's creature; the discard is charged before the target is aimed.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { STERN_CONSTABLE_SCRIPT } from './sternConstable';
import { advanceUntil, idsIn, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const CONSTABLE = 'Stern Constable';
const BEARS = 'Grizzly Bears';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function ready(): { g: Game; constable: InstanceId; theirs: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [[CONSTABLE], [BEARS]],
    scripts: createRegistry([STERN_CONSTABLE_SCRIPT]),
  });
  const theirs = put(g, 'p2', BEARS);
  const constable = put(g, 'p1', CONSTABLE);
  settle(g);
  advanceUntil(g, (s) => s.turn.turnNumber >= 3 && s.priority.awaiting === null, 60_000);
  return { g, constable, theirs };
}

describe('Stern Constable', () => {
  test('{T}, discard a card: the target creature is tapped', () => {
    const { g, constable, theirs } = ready();
    const chosen = idsIn(g, 'p1', 'hand')[0] as InstanceId;
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: constable, abilityIndex: 0, discard: [chosen] }));
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: theirs }] }));
    settle(g);
    expect(g.state.cards[theirs]?.tapped).toBe(true);
    expect(g.state.cards[constable]?.tapped).toBe(true);
    expect(g.state.cards[chosen]?.zone).toEqual({ kind: 'graveyard', player: 'p1' });
  });

  test('the discard rides the pending through the targets prompt', () => {
    const { g, constable } = ready();
    const chosen = idsIn(g, 'p1', 'hand')[0] as InstanceId;
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: constable, abilityIndex: 0, discard: [chosen] }));
    expect(g.state.priority.awaiting?.kind).toBe('chooseTargets');
    expect(g.state.pendingCast?.discard).toEqual([chosen]);
  });

  test('replays to the same hash', () => {
    const { g, constable, theirs } = ready();
    const chosen = idsIn(g, 'p1', 'hand')[0] as InstanceId;
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: constable, abilityIndex: 0, discard: [chosen] }));
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: theirs }] }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
