// `Righteous Fury` — the tapped die and pay 2 each; the untapped and
// the indestructible both stand, and the survivor pays NOTHING.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { RIGHTEOUS_FURY_SCRIPT } from './righteousFury';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function board(): { g: Game; bears: InstanceId; myr: InstanceId; maw: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [
      ['Righteous Fury', 'Grizzly Bears', 'Darksteel Myr'],
      ['Colossal Dreadmaw'],
    ],
    scripts: createRegistry([RIGHTEOUS_FURY_SCRIPT]),
  });
  const bears = put(g, 'p1', 'Grizzly Bears');
  const myr = put(g, 'p1', 'Darksteel Myr');
  const maw = put(g, 'p2', 'Colossal Dreadmaw');
  must(g.submit({ t: 'ManualSetTapped', player: 'p1', cards: [bears, myr], tapped: true }));
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const spell = put(g, 'p1', 'Righteous Fury', 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 4 }));
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'W', amount: 2 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  settle(g);
  return { g, bears, myr, maw };
}

describe('Righteous Fury', () => {
  test('one kill, 2 life; indestructible and untapped both stand', () => {
    const { g, bears, myr, maw } = board();
    expect(g.state.cards[bears]?.zone.kind).toBe('graveyard');
    expect(g.state.cards[myr]?.zone.kind).toBe('battlefield');
    expect(g.state.cards[maw]?.zone.kind).toBe('battlefield');
    expect(g.state.players['p1']?.life).toBe(42);
  });

  test('replays to the same hash', () => {
    const { g } = board();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
