// `Seismic Strike` — three Mountains kill the 1/3.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { SEISMIC_STRIKE_SCRIPT } from './seismicStrike';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function struck(mountains: number): { g: Game; crab: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [
      ['Seismic Strike', 'Mountain', 'Mountain', 'Mountain'],
      ['Riptide Crab'],
    ],
    scripts: createRegistry([SEISMIC_STRIKE_SCRIPT]),
  });
  for (let i = 0; i < mountains; i++) put(g, 'p1', 'Mountain');
  const crab = put(g, 'p2', 'Riptide Crab');
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const spell = put(g, 'p1', 'Seismic Strike', 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 2 }));
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'R', amount: 1 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
  must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: crab }] }));
  settle(g);
  return { g, crab };
}

describe('Seismic Strike', () => {
  test('two Mountains leave the 1/3 alive; three kill it', () => {
    const two = struck(2);
    expect(two.g.state.cards[two.crab]?.zone.kind).toBe('battlefield');
    const three = struck(3);
    expect(three.g.state.cards[three.crab]?.zone.kind).toBe('graveyard');
  });

  test('replays to the same hash', () => {
    const { g } = struck(3);
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
