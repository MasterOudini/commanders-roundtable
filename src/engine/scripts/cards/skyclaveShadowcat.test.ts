// `Skyclave Shadowcat` - the activation's counter (and its counterless fodder drawing
// nothing), a countered creature of yours dying drawing a card, the opponent's
// countered creature drawing nothing, the cat itself dying with its counter, the
// replay hash.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { SKYCLAVE_SHADOWCAT_SCRIPT } from './skyclaveShadowcat';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const CARD = 'Skyclave Shadowcat';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function handOf(g: Game): number {
  return (g.state.zones.hand.p1 ?? []).length;
}

function armed(): { g: Game; self: InstanceId; bears: InstanceId; eel: InstanceId; no: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [[CARD, 'Grizzly Bears', 'Coral Eel'], ['Cyclops of One-Eyed Pass']],
    scripts: createRegistry([SKYCLAVE_SHADOWCAT_SCRIPT]),
  });
  holdEverywhere(g);
  const self = put(g, 'p1', CARD);
  const bears = put(g, 'p1', 'Grizzly Bears');
  const eel = put(g, 'p1', 'Coral Eel');
  const no = put(g, 'p2', 'Cyclops of One-Eyed Pass');
  settle(g);
  advanceUntil(g, (s) => s.turn.turnNumber === 3 && s.turn.phase === 'precombatMain' && s.priority.player === 'p1' && s.priority.awaiting === null, 20_000);
  return { g, self, bears, eel, no };
}

function activate(g: Game, self: InstanceId, fodder: InstanceId): void {
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 1 }));
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'B', amount: 1 }));
  must(g.submit({ t: 'ActivateAbility', player: 'p1', card: self, abilityIndex: 0, sacrifice: fodder }));
  settle(g);
}

describe(CARD, () => {
  test('{1}{B}, sacrifice another creature: a +1/+1 counter on it; the counterless fodder draws nothing', () => {
    const { g, self, bears } = armed();
    const hand0 = handOf(g);
    activate(g, self, bears);
    expect(g.state.cards[self]?.counters['+1/+1'] ?? 0).toBe(1);
    expect(g.state.cards[bears]?.zone.kind).toBe('graveyard');
    expect(handOf(g)).toBe(hand0);
  });

  test('a creature you control with a +1/+1 counter dying draws a card', () => {
    const { g, eel } = armed();
    const hand0 = handOf(g);
    must(g.submit({ t: 'ManualSetCounter', player: 'p1', card: eel, kind: '+1/+1', delta: 1 }));
    settle(g);
    must(g.submit({ t: 'ManualMoveCard', player: 'p1', card: eel, to: { kind: 'graveyard', player: 'p1' } }));
    settle(g);
    expect(handOf(g)).toBe(hand0 + 1);
  });

  test('the opponent countered creature dying draws nothing', () => {
    const { g, no } = armed();
    const hand0 = handOf(g);
    must(g.submit({ t: 'ManualSetCounter', player: 'p2', card: no, kind: '+1/+1', delta: 1 }));
    settle(g);
    must(g.submit({ t: 'ManualMoveCard', player: 'p2', card: no, to: { kind: 'graveyard', player: 'p2' } }));
    settle(g);
    expect(handOf(g)).toBe(hand0);
  });

  test('the cat dying with its own counter draws a card (it looks back)', () => {
    const { g, self, bears } = armed();
    activate(g, self, bears);
    const hand1 = handOf(g);
    must(g.submit({ t: 'ManualMoveCard', player: 'p1', card: self, to: { kind: 'graveyard', player: 'p1' } }));
    settle(g);
    expect(handOf(g)).toBe(hand1 + 1);
  });

  test('replays to the same hash', () => {
    const { g, self, bears } = armed();
    activate(g, self, bears);
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
