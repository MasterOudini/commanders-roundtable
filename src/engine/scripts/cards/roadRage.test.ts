// `Road Rage` — X is 2 alone and 3 behind a Vehicle: the 1/3 Crab
// survives the bare 2 and dies to the ridden 3.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { ROAD_RAGE_SCRIPT } from './roadRage';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function raged(withVehicle: boolean): { g: Game; crab: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [
      ['Road Rage', 'Consulate Dreadnought'],
      ['Riptide Crab'],
    ],
    scripts: createRegistry([ROAD_RAGE_SCRIPT]),
  });
  if (withVehicle) put(g, 'p1', 'Consulate Dreadnought');
  const crab = put(g, 'p2', 'Riptide Crab');
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const spell = put(g, 'p1', 'Road Rage', 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'R', amount: 1 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
  must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: crab }] }));
  settle(g);
  return { g, crab };
}

describe('Road Rage', () => {
  test('no rides: 2 damage leaves the 1/3 alive', () => {
    const { g, crab } = raged(false);
    expect(g.state.cards[crab]?.zone.kind).toBe('battlefield');
  });

  test('a Vehicle makes it 3 and the 1/3 dies', () => {
    const { g, crab } = raged(true);
    expect(g.state.cards[crab]?.zone.kind).toBe('graveyard');
  });

  test('replays to the same hash', () => {
    const { g } = raged(true);
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
