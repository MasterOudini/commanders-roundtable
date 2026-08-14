// `Generous Visitor` — an ENCHANTMENT cast pays a +1/+1 counter through the
// trigger's own target prompt; a creature cast pays nothing.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { GENEROUS_VISITOR_SCRIPT } from './generousVisitor';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const VISITOR = 'Generous Visitor';
const AURA = 'Pacifism';
const BEARS = 'Grizzly Bears';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function board(): { g: Game; visitor: InstanceId; bears: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [[VISITOR, AURA, BEARS], []],
    scripts: createRegistry([GENEROUS_VISITOR_SCRIPT]),
  });
  const visitor = put(g, 'p1', VISITOR);
  const bears = put(g, 'p1', BEARS);
  settle(g);
  return { g, visitor, bears };
}

describe('Generous Visitor', () => {
  test('casting an enchantment pays a +1/+1 counter on the chosen creature', () => {
    const { g, bears } = board();
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'W', amount: 1 }));
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 1 }));
    const aura = put(g, 'p1', AURA, 'hand');
    must(g.submit({ t: 'CastSpell', player: 'p1', card: aura }));
    // First prompt: the Aura's own target; second: the trigger's.
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: bears }] }));
    expect(g.state.priority.awaiting?.kind).toBe('chooseTargets');
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: bears }] }));
    settle(g);
    expect(g.state.cards[bears]?.counters['+1/+1']).toBe(1);
  });

  test('casting a CREATURE pays nothing', () => {
    const { g, bears } = board();
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'G', amount: 1 }));
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 1 }));
    const second = put(g, 'p1', BEARS, 'hand');
    must(g.submit({ t: 'CastSpell', player: 'p1', card: second }));
    settle(g);
    expect(g.state.cards[bears]?.counters['+1/+1']).toBeUndefined();
  });

  test('replays to the same hash', () => {
    const { g, bears } = board();
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'W', amount: 1 }));
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 1 }));
    const aura = put(g, 'p1', AURA, 'hand');
    must(g.submit({ t: 'CastSpell', player: 'p1', card: aura }));
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: bears }] }));
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: bears }] }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
