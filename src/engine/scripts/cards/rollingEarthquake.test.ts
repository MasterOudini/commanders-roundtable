// `Rolling Earthquake` — X=3 kills the 2/2, spares the 6/6, and bills
// every player.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { ROLLING_EARTHQUAKE_SCRIPT } from './rollingEarthquake';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function quaked(): { g: Game; bears: InstanceId; maw: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [
      ['Rolling Earthquake', 'Colossal Dreadmaw'],
      ['Grizzly Bears'],
    ],
    scripts: createRegistry([ROLLING_EARTHQUAKE_SCRIPT]),
  });
  const maw = put(g, 'p1', 'Colossal Dreadmaw');
  const bears = put(g, 'p2', 'Grizzly Bears');
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const spell = put(g, 'p1', 'Rolling Earthquake', 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 3 }));
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'R', amount: 1 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell, xValue: 3 }));
  settle(g);
  return { g, bears, maw };
}

describe('Rolling Earthquake', () => {
  test('X=3: the 2/2 dies, the 6/6 stands, both players take 3', () => {
    const { g, bears, maw } = quaked();
    expect(g.state.cards[bears]?.zone.kind).toBe('graveyard');
    expect(g.state.cards[maw]?.zone.kind).toBe('battlefield');
    expect(g.state.players['p1']?.life).toBe(37);
    expect(g.state.players['p2']?.life).toBe(37);
  });

  test('replays to the same hash', () => {
    const { g } = quaked();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
