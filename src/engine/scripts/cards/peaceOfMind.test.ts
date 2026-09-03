// `Peace of Mind` — white mana and a discarded card of my choice are 3 life.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { PEACE_OF_MIND_SCRIPT } from './peaceOfMind';
import { advanceUntil, idsIn, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const PEACE = 'Peace of Mind';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function placed(): { g: Game; peace: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [[PEACE], []],
    scripts: createRegistry([PEACE_OF_MIND_SCRIPT]),
  });
  const peace = put(g, 'p1', PEACE);
  settle(g);
  return { g, peace };
}

describe('Peace of Mind', () => {
  test('{W}, discard a card: 3 life', () => {
    const { g, peace } = placed();
    const hand = idsIn(g, 'p1', 'hand');
    const chosen = hand[1] as InstanceId;
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'W', amount: 1 }));
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: peace, abilityIndex: 0, discard: [chosen], targets: [] }));
    settle(g);
    expect(g.state.players['p1']?.life).toBe(43);
    expect(g.state.cards[chosen]?.zone).toEqual({ kind: 'graveyard', player: 'p1' });
    expect(g.state.cards[peace]?.zone.kind).toBe('battlefield');
  });

  test('twice in a turn, two cards gone', () => {
    const { g, peace } = placed();
    const hand = idsIn(g, 'p1', 'hand');
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'W', amount: 2 }));
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: peace, abilityIndex: 0, discard: [hand[0] as InstanceId], targets: [] }));
    settle(g);
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: peace, abilityIndex: 0, discard: [hand[1] as InstanceId], targets: [] }));
    settle(g);
    expect(g.state.players['p1']?.life).toBe(46);
    expect(idsIn(g, 'p1', 'hand').length).toBe(hand.length - 2);
  });

  test('replays to the same hash', () => {
    const { g, peace } = placed();
    const chosen = idsIn(g, 'p1', 'hand')[0] as InstanceId;
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'W', amount: 1 }));
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: peace, abilityIndex: 0, discard: [chosen], targets: [] }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
