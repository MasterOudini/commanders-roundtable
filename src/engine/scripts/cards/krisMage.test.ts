// `Kris Mage` — red mana, the tap and a discarded card deal 1 to the
// opponent.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { KRIS_MAGE_SCRIPT } from './krisMage';
import { advanceUntil, idsIn, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const MAGE = 'Kris Mage';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function ready(): { g: Game; mage: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [[MAGE], []],
    scripts: createRegistry([KRIS_MAGE_SCRIPT]),
  });
  const mage = put(g, 'p1', MAGE);
  settle(g);
  advanceUntil(g, (s) => s.turn.turnNumber >= 3 && s.priority.awaiting === null, 60_000);
  return { g, mage };
}

describe('Kris Mage', () => {
  test('{R}, {T}, discard a card: 1 damage to the opponent', () => {
    const { g, mage } = ready();
    const chosen = idsIn(g, 'p1', 'hand')[0] as InstanceId;
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'R', amount: 1 }));
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: mage, abilityIndex: 0, discard: [chosen] }));
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'player', id: 'p2' }] }));
    settle(g);
    expect(g.state.players['p2']?.life).toBe(39);
    expect(g.state.cards[chosen]?.zone.kind).toBe('graveyard');
    expect(g.state.cards[mage]?.tapped).toBe(true);
  });

  test('replays to the same hash', () => {
    const { g, mage } = ready();
    const chosen = idsIn(g, 'p1', 'hand')[0] as InstanceId;
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'R', amount: 1 }));
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: mage, abilityIndex: 0, discard: [chosen] }));
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'player', id: 'p2' }] }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
