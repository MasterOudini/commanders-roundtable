// `Seismic Mage` — three mana, the tap and a discarded card destroy the
// opponent's land.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { SEISMIC_MAGE_SCRIPT } from './seismicMage';
import { advanceUntil, idsIn, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const MAGE = 'Seismic Mage';
const ISLAND = 'Island';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function ready(): { g: Game; mage: InstanceId; island: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [[MAGE], [ISLAND]],
    scripts: createRegistry([SEISMIC_MAGE_SCRIPT]),
  });
  const island = put(g, 'p2', ISLAND);
  const mage = put(g, 'p1', MAGE);
  settle(g);
  advanceUntil(g, (s) => s.turn.turnNumber >= 3 && s.priority.awaiting === null, 60_000);
  return { g, mage, island };
}

describe('Seismic Mage', () => {
  test('{2}{R}, {T}, discard a card: their Island is destroyed', () => {
    const { g, mage, island } = ready();
    const chosen = idsIn(g, 'p1', 'hand')[0] as InstanceId;
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'R', amount: 1 }));
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 2 }));
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: mage, abilityIndex: 0, discard: [chosen] }));
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: island }] }));
    settle(g);
    expect(g.state.cards[island]?.zone).toEqual({ kind: 'graveyard', player: 'p2' });
    expect(g.state.cards[chosen]?.zone.kind).toBe('graveyard');
  });

  test('replays to the same hash', () => {
    const { g, mage, island } = ready();
    const chosen = idsIn(g, 'p1', 'hand')[0] as InstanceId;
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'R', amount: 1 }));
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 2 }));
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: mage, abilityIndex: 0, discard: [chosen] }));
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: island }] }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
