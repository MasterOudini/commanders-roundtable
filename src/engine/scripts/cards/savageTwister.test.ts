// `Savage Twister` — X=2 kills the 2/2 on BOTH sides and spares the 6/6.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { SAVAGE_TWISTER_SCRIPT } from './savageTwister';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function twisted(): { g: Game; mine: InstanceId; theirs: InstanceId; maw: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [
      ['Savage Twister', 'Grizzly Bears', 'Colossal Dreadmaw'],
      ['Grizzly Bears'],
    ],
    scripts: createRegistry([SAVAGE_TWISTER_SCRIPT]),
  });
  const mine = put(g, 'p1', 'Grizzly Bears');
  const maw = put(g, 'p1', 'Colossal Dreadmaw');
  const theirs = put(g, 'p2', 'Grizzly Bears');
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const spell = put(g, 'p1', 'Savage Twister', 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 2 }));
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'R', amount: 1 }));
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'G', amount: 1 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell, xValue: 2 }));
  settle(g);
  return { g, mine, theirs, maw };
}

describe('Savage Twister', () => {
  test('X=2 kills both 2/2s and spares the 6/6', () => {
    const { g, mine, theirs, maw } = twisted();
    expect(g.state.cards[mine]?.zone.kind).toBe('graveyard');
    expect(g.state.cards[theirs]?.zone.kind).toBe('graveyard');
    expect(g.state.cards[maw]?.zone.kind).toBe('battlefield');
  });

  test('replays to the same hash', () => {
    const { g } = twisted();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
