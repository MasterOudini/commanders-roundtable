// `Rotlung Reanimator` — a Cleric dying pays a Zombie, a non-Cleric pays
// nothing, and a sweep killing BOTH Clerics pays TWO: the perItem proof.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { ROTLUNG_REANIMATOR_SCRIPT } from './rotlungReanimator';
import { RITUAL_OF_SOOT_SCRIPT } from './ritualOfSoot';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function tokens(g: Game): number {
  return (g.state.zones.battlefield ?? []).filter((id) => g.state.cards[id]?.isToken).length;
}

function reanimated(): { g: Game; cleric: InstanceId; bears: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [
      ['Rotlung Reanimator', 'Moonrise Cleric', 'Grizzly Bears', 'Ritual of Soot'],
      [],
    ],
    scripts: createRegistry([ROTLUNG_REANIMATOR_SCRIPT, RITUAL_OF_SOOT_SCRIPT]),
  });
  put(g, 'p1', 'Rotlung Reanimator');
  const cleric = put(g, 'p1', 'Moonrise Cleric');
  const bears = put(g, 'p1', 'Grizzly Bears');
  settle(g);
  holdEverywhere(g);
  return { g, cleric, bears };
}

describe('Rotlung Reanimator', () => {
  test('a dying Cleric pays; a dying non-Cleric does not', () => {
    const { g, cleric, bears } = reanimated();
    must(
      g.submit({
        t: 'ManualMoveCard',
        player: 'p1',
        card: bears,
        to: { kind: 'graveyard', player: 'p1' },
      }),
    );
    settle(g);
    expect(tokens(g)).toBe(0);
    must(
      g.submit({
        t: 'ManualMoveCard',
        player: 'p1',
        card: cleric,
        to: { kind: 'graveyard', player: 'p1' },
      }),
    );
    settle(g);
    expect(tokens(g)).toBe(1);
  });

  test('a sweep killing both Clerics pays TWO Zombies — one per item', () => {
    const { g } = reanimated();
    advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
    const soot = put(g, 'p1', 'Ritual of Soot', 'hand');
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 2 }));
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'B', amount: 2 }));
    must(g.submit({ t: 'CastSpell', player: 'p1', card: soot }));
    settle(g);
    // Rotlung (mv 3), the Cleric and the Bears all die to the sweep; the
    // two Clerics each pay a Zombie, arriving after the sweep resolved.
    expect(tokens(g)).toBe(2);
  });

  test('replays to the same hash', () => {
    const { g } = reanimated();
    advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
    const soot = put(g, 'p1', 'Ritual of Soot', 'hand');
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 2 }));
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'B', amount: 2 }));
    must(g.submit({ t: 'CastSpell', player: 'p1', card: soot }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
