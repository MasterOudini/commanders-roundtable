// `Undertaker` — black mana, the tap and a discarded card return a creature
// card from my graveyard to my hand.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { UNDERTAKER_SCRIPT } from './undertaker';
import { advanceUntil, idsIn, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const UNDERTAKER = 'Undertaker';
const BEARS = 'Grizzly Bears';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function ready(): { g: Game; undertaker: InstanceId; dead: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [[UNDERTAKER, BEARS], []],
    scripts: createRegistry([UNDERTAKER_SCRIPT]),
  });
  const dead = put(g, 'p1', BEARS, 'graveyard');
  const undertaker = put(g, 'p1', UNDERTAKER);
  settle(g);
  advanceUntil(g, (s) => s.turn.turnNumber >= 3 && s.priority.awaiting === null, 60_000);
  return { g, undertaker, dead };
}

describe('Undertaker', () => {
  test('{B}, {T}, discard a card: the bear returns from my graveyard to my hand', () => {
    const { g, undertaker, dead } = ready();
    const chosen = idsIn(g, 'p1', 'hand')[0] as InstanceId;
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'B', amount: 1 }));
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: undertaker, abilityIndex: 0, discard: [chosen] }));
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: dead }] }));
    settle(g);
    expect(g.state.cards[dead]?.zone).toEqual({ kind: 'hand', player: 'p1' });
    expect(g.state.cards[chosen]?.zone.kind).toBe('graveyard');
  });

  test('replays to the same hash', () => {
    const { g, undertaker, dead } = ready();
    const chosen = idsIn(g, 'p1', 'hand')[0] as InstanceId;
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'B', amount: 1 }));
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: undertaker, abilityIndex: 0, discard: [chosen] }));
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: dead }] }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
