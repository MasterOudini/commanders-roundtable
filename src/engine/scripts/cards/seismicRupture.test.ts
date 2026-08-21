// `Seismic Rupture` — the grounded 2/2 dies, the flyer is exempt.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { SEISMIC_RUPTURE_SCRIPT } from './seismicRupture';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function ruptured(): { g: Game; bears: InstanceId; drake: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [
      ['Seismic Rupture', 'Muse Drake'],
      ['Grizzly Bears'],
    ],
    scripts: createRegistry([SEISMIC_RUPTURE_SCRIPT]),
  });
  const drake = put(g, 'p1', 'Muse Drake');
  const bears = put(g, 'p2', 'Grizzly Bears');
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const spell = put(g, 'p1', 'Seismic Rupture', 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 2 }));
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'R', amount: 1 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  settle(g);
  return { g, bears, drake };
}

describe('Seismic Rupture', () => {
  test('the grounded 2/2 dies; the flyer stands', () => {
    const { g, bears, drake } = ruptured();
    expect(g.state.cards[bears]?.zone.kind).toBe('graveyard');
    expect(g.state.cards[drake]?.zone.kind).toBe('battlefield');
  });

  test('replays to the same hash', () => {
    const { g } = ruptured();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
