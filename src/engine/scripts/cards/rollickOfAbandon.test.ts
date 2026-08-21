// `Rollick of Abandon` — +2/-2 kills the 2/2 through the SBA and leaves
// the 6/6 standing.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { ROLLICK_OF_ABANDON_SCRIPT } from './rollickOfAbandon';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function rollicked(): { g: Game; bears: InstanceId; maw: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [
      ['Rollick of Abandon', 'Colossal Dreadmaw'],
      ['Grizzly Bears'],
    ],
    scripts: createRegistry([ROLLICK_OF_ABANDON_SCRIPT]),
  });
  const maw = put(g, 'p1', 'Colossal Dreadmaw');
  const bears = put(g, 'p2', 'Grizzly Bears');
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const spell = put(g, 'p1', 'Rollick of Abandon', 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 3 }));
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'R', amount: 2 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  settle(g);
  return { g, bears, maw };
}

describe('Rollick of Abandon', () => {
  test('the 2/2 dies at -2 toughness; the 6/6 survives', () => {
    const { g, bears, maw } = rollicked();
    expect(g.state.cards[bears]?.zone.kind).toBe('graveyard');
    expect(g.state.cards[maw]?.zone.kind).toBe('battlefield');
  });

  test('replays to the same hash', () => {
    const { g } = rollicked();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
