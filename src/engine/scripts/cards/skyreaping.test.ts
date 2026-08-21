// `Skyreaping` — devotion 2 kills the 1/1 flyer; every grounded creature is
// exempt.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { SKYREAPING_SCRIPT } from './skyreaping';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function reaped(): { g: Game; flyer: InstanceId; ground: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [
      ['Skyreaping', 'Grizzly Bears', 'Grizzly Bears'],
      ['Skyscanner'],
    ],
    scripts: createRegistry([SKYREAPING_SCRIPT]),
  });
  const ground = put(g, 'p1', 'Grizzly Bears');
  put(g, 'p1', 'Grizzly Bears');
  const flyer = put(g, 'p2', 'Skyscanner');
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const spell = put(g, 'p1', 'Skyreaping', 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'G', amount: 2 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  settle(g);
  return { g, flyer, ground };
}

describe('Skyreaping', () => {
  test('the flyer dies to devotion 2; the ground Bears stand', () => {
    const { g, flyer, ground } = reaped();
    expect(g.state.cards[flyer]?.zone.kind).toBe('graveyard');
    expect(g.state.cards[ground]?.zone.kind).toBe('battlefield');
  });

  test('replays to the same hash', () => {
    const { g } = reaped();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
