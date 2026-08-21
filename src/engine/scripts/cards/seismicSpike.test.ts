// `Seismic Spike` — the land dies and {R}{R} lands in the pool.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { SEISMIC_SPIKE_SCRIPT } from './seismicSpike';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function spiked(): { g: Game; land: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [['Seismic Spike'], ['Mountain']],
    scripts: createRegistry([SEISMIC_SPIKE_SCRIPT]),
  });
  const land = put(g, 'p2', 'Mountain');
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const spell = put(g, 'p1', 'Seismic Spike', 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 2 }));
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'R', amount: 2 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
  must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: land }] }));
  settle(g);
  return { g, land };
}

describe('Seismic Spike', () => {
  test('the land dies and the ritual pays {R}{R}', () => {
    const { g, land } = spiked();
    expect(g.state.cards[land]?.zone.kind).toBe('graveyard');
    expect(g.state.players['p1']?.pool.R).toBe(2);
  });

  test('replays to the same hash', () => {
    const { g } = spiked();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
