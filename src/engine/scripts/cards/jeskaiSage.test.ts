// `Jeskai Sage` - dying draws its controller a card, leaving the battlefield
// for exile draws nothing, its prowess still runs from the keyword table
// (no claim of its own), the replay hash.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { derive } from '../../derive';
import { createRegistry } from '../registry';
import { JESKAI_SAGE_SCRIPT } from './jeskaiSage';
import { advanceUntil, deps, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const CARD = 'Jeskai Sage';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function handOf(g: Game): number {
  return (g.state.zones.hand.p1 ?? []).length;
}

function armed(): { g: Game; self: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [[CARD, 'Feeling of Dread'], ['Cyclops of One-Eyed Pass']],
    scripts: createRegistry([JESKAI_SAGE_SCRIPT]),
  });
  holdEverywhere(g);
  const self = put(g, 'p1', CARD);
  put(g, 'p2', 'Cyclops of One-Eyed Pass');
  settle(g);
  advanceUntil(g, (s) => s.turn.turnNumber === 3 && s.turn.phase === 'precombatMain' && s.priority.player === 'p1' && s.priority.awaiting === null, 20_000);
  return { g, self };
}

describe(CARD, () => {
  test('dying draws a card', () => {
    const { g, self } = armed();
    const hand0 = handOf(g);
    must(g.submit({ t: 'ManualMoveCard', player: 'p1', card: self, to: { kind: 'graveyard', player: 'p1' } }));
    settle(g);
    expect(g.state.cards[self]?.zone.kind).toBe('graveyard');
    expect(handOf(g)).toBe(hand0 + 1);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });

  test('leaving for exile is not dying', () => {
    const { g, self } = armed();
    const hand0 = handOf(g);
    must(g.submit({ t: 'ManualMoveCard', player: 'p1', card: self, to: { kind: 'exile', player: 'p1' } }));
    settle(g);
    expect(handOf(g)).toBe(hand0);
  });

  test('its prowess runs from the keyword table, unclaimed', () => {
    const { g, self } = armed();
    const dread = put(g, 'p1', 'Feeling of Dread', 'hand');
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'W', amount: 1 }));
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 1 }));
    must(g.submit({ t: 'CastSpell', player: 'p1', card: dread, targets: [] }));
    settle(g);
    const d = deps(createRegistry([JESKAI_SAGE_SCRIPT]));
    const got = derive(g.state, d.oracle, d.scripts, self);
    expect([got.power, got.toughness]).toEqual([2, 2]);
  });
});
