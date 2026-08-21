// `Rise of the Dark Realms` — every graveyard's creatures rise under MY
// control; the owners stay printed.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { RISE_OF_THE_DARK_REALMS_SCRIPT } from './riseOfTheDarkRealms';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function risen(): { g: Game; mine: InstanceId; theirs: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [
      ['Rise of the Dark Realms', 'Grizzly Bears'],
      ['Colossal Dreadmaw'],
    ],
    scripts: createRegistry([RISE_OF_THE_DARK_REALMS_SCRIPT]),
  });
  const mine = put(g, 'p1', 'Grizzly Bears', 'graveyard');
  const theirs = put(g, 'p2', 'Colossal Dreadmaw', 'graveyard');
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const spell = put(g, 'p1', 'Rise of the Dark Realms', 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 7 }));
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'B', amount: 2 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  settle(g);
  return { g, mine, theirs };
}

describe('Rise of the Dark Realms', () => {
  test('both corpses rise, both under MY control, owners printed', () => {
    const { g, mine, theirs } = risen();
    expect(g.state.cards[mine]?.zone.kind).toBe('battlefield');
    expect(g.state.cards[theirs]?.zone.kind).toBe('battlefield');
    expect(g.state.cards[mine]?.controller).toBe('p1');
    expect(g.state.cards[theirs]?.controller).toBe('p1');
    expect(g.state.cards[theirs]?.owner).toBe('p2');
  });

  test('replays to the same hash', () => {
    const { g } = risen();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
