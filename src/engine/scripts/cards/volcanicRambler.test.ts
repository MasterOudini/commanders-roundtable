// `Volcanic Rambler` — the ping at a player and at a PLANESWALKER, twice in
// one turn because no {T} is in the cost.
//
// ⚠️ Damage to a planeswalker is only MARKED in this engine (D257), so the
// walker case asserts `damage` and never a loyalty delta.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { VOLCANIC_RAMBLER_SCRIPT } from './volcanicRambler';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const RAMBLER = 'Volcanic Rambler';
const WALKER = 'Grist, the Hunger Tide';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function board(): { g: Game; rambler: InstanceId; walker: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [[RAMBLER], [WALKER]],
    scripts: createRegistry([VOLCANIC_RAMBLER_SCRIPT]),
  });
  const walker = put(g, 'p2', WALKER);
  const rambler = put(g, 'p1', RAMBLER);
  settle(g);
  advanceUntil(g, (s) => s.turn.turnNumber >= 3 && s.priority.awaiting === null, 60_000);
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 8 }));
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'R', amount: 4 }));
  return { g, rambler, walker };
}

describe('Volcanic Rambler', () => {
  test('1 damage at a player, and it goes TWICE in one turn (no {T})', () => {
    const { g, rambler } = board();
    for (let i = 0; i < 2; i += 1) {
      must(g.submit({ t: 'ActivateAbility', player: 'p1', card: rambler, abilityIndex: 0 }));
      must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'player', id: 'p2' }] }));
      settle(g);
    }
    expect(g.state.players['p2']?.life).toBe(38);
    expect(g.state.cards[rambler]?.tapped).toBe(false);
  });

  test('a PLANESWALKER is marked with the damage', () => {
    const { g, rambler, walker } = board();
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: rambler, abilityIndex: 0 }));
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: walker }] }));
    settle(g);
    expect(g.state.cards[walker]?.damage).toBe(1);
    expect(g.state.players['p2']?.life).toBe(40);
  });

  test('replays to the same hash', () => {
    const { g, rambler } = board();
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: rambler, abilityIndex: 0 }));
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'player', id: 'p2' }] }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
