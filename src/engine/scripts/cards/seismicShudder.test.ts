// `Seismic Shudder` — 1 to each grounded creature: the 1/1 dies, the
// flyer is exempt.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { SEISMIC_SHUDDER_SCRIPT } from './seismicShudder';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function shuddered(): { g: Game; small: InstanceId; drake: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [
      ['Seismic Shudder', 'Muse Drake'],
      ['Aysen Bureaucrats'],
    ],
    scripts: createRegistry([SEISMIC_SHUDDER_SCRIPT]),
  });
  const drake = put(g, 'p1', 'Muse Drake');
  const small = put(g, 'p2', 'Aysen Bureaucrats');
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const spell = put(g, 'p1', 'Seismic Shudder', 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 1 }));
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'R', amount: 1 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  settle(g);
  return { g, small, drake };
}

describe('Seismic Shudder', () => {
  test('the grounded 1/1 dies; the flyer stands', () => {
    const { g, small, drake } = shuddered();
    expect(g.state.cards[small]?.zone.kind).toBe('graveyard');
    expect(g.state.cards[drake]?.zone.kind).toBe('battlefield');
  });

  test('replays to the same hash', () => {
    const { g } = shuddered();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
