// `Tower of Calamities` — 12 damage for {8} and a tap.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { TOWER_OF_CALAMITIES_SCRIPT } from './towerOfCalamities';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const TOWER = 'Tower of Calamities';
const TITAN = 'Grave Titan'; // 6/6 — 12 is comfortably lethal

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function fired(): { g: Game; tower: InstanceId; victim: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [[TOWER], [TITAN]],
    scripts: createRegistry([TOWER_OF_CALAMITIES_SCRIPT]),
  });
  const tower = put(g, 'p1', TOWER);
  const victim = put(g, 'p2', TITAN);
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 8 }));
  must(g.submit({ t: 'ActivateAbility', player: 'p1', card: tower, abilityIndex: 0 }));
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
  must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: victim }] }));
  settle(g);
  return { g, tower, victim };
}

describe('Tower of Calamities', () => {
  test('12 damage kills a 6/6, and the Tower taps rather than dying', () => {
    const { g, tower, victim } = fired();
    expect(g.state.cards[victim]?.zone.kind).toBe('graveyard');
    expect(g.state.cards[tower]?.zone.kind).toBe('battlefield');
    expect(g.state.cards[tower]?.tapped).toBe(true);
  });

  test('replays to the same hash', () => {
    const { g } = fired();
    advanceUntil(g, (s) => s.turn.turnNumber >= 3, 120_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
