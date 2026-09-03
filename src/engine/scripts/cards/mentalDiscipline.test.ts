// `Mental Discipline` — two mana and a discarded card of my choice buy a
// card: the hand ends the same size, one card swapped for another.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { MENTAL_DISCIPLINE_SCRIPT } from './mentalDiscipline';
import { advanceUntil, idsIn, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const DISCIPLINE = 'Mental Discipline';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function drawsFor(g: Game, player: string, from: number): number {
  let n = 0;
  for (const e of g.log.slice(from)) {
    if (e.body.t !== 'CardsMoved') continue;
    n += e.body.moves.filter((m) => m.from.kind === 'library' && m.to.kind === 'hand' && m.to.player === player).length;
  }
  return n;
}

function placed(): { g: Game; discipline: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [[DISCIPLINE], []],
    scripts: createRegistry([MENTAL_DISCIPLINE_SCRIPT]),
  });
  const discipline = put(g, 'p1', DISCIPLINE);
  settle(g);
  return { g, discipline };
}

describe('Mental Discipline', () => {
  test('{1}{U}, discard a card: draw a card', () => {
    const { g, discipline } = placed();
    const hand = idsIn(g, 'p1', 'hand');
    const chosen = hand[2] as InstanceId;
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'U', amount: 1 }));
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 1 }));
    const logAt = g.log.length;
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: discipline, abilityIndex: 0, discard: [chosen], targets: [] }));
    settle(g);
    expect(g.state.cards[chosen]?.zone).toEqual({ kind: 'graveyard', player: 'p1' });
    expect(drawsFor(g, 'p1', logAt)).toBe(1);
    expect(idsIn(g, 'p1', 'hand').length).toBe(hand.length);
    expect(idsIn(g, 'p1', 'hand').includes(chosen)).toBe(false);
  });

  test('two cards named for a one-card cost is refused', () => {
    const { g, discipline } = placed();
    const hand = idsIn(g, 'p1', 'hand');
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'U', amount: 1 }));
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 1 }));
    const res = g.submit({
      t: 'ActivateAbility',
      player: 'p1',
      card: discipline,
      abilityIndex: 0,
      discard: [hand[0] as InstanceId, hand[1] as InstanceId],
      targets: [],
    });
    expect(res.ok).toBe(false);
    expect(idsIn(g, 'p1', 'hand').length).toBe(hand.length);
  });

  test('replays to the same hash', () => {
    const { g, discipline } = placed();
    const chosen = idsIn(g, 'p1', 'hand')[0] as InstanceId;
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'U', amount: 1 }));
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 1 }));
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: discipline, abilityIndex: 0, discard: [chosen], targets: [] }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
