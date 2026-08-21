// `Ritual of Soot` — mv 2 dies, mv 6 lives, and the mv-3 indestructible
// survives on the other check.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { RITUAL_OF_SOOT_SCRIPT } from './ritualOfSoot';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function sooted(): { g: Game; bears: InstanceId; maw: InstanceId; myr: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [
      ['Ritual of Soot', 'Grizzly Bears', 'Darksteel Myr'],
      ['Colossal Dreadmaw'],
    ],
    scripts: createRegistry([RITUAL_OF_SOOT_SCRIPT]),
  });
  const bears = put(g, 'p1', 'Grizzly Bears');
  const myr = put(g, 'p1', 'Darksteel Myr');
  const maw = put(g, 'p2', 'Colossal Dreadmaw');
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const spell = put(g, 'p1', 'Ritual of Soot', 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 2 }));
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'B', amount: 2 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  settle(g);
  return { g, bears, maw, myr };
}

describe('Ritual of Soot', () => {
  test('mv 2 dies; mv 6 and the indestructible both stand', () => {
    const { g, bears, maw, myr } = sooted();
    expect(g.state.cards[bears]?.zone.kind).toBe('graveyard');
    expect(g.state.cards[maw]?.zone.kind).toBe('battlefield');
    expect(g.state.cards[myr]?.zone.kind).toBe('battlefield');
  });

  test('replays to the same hash', () => {
    const { g } = sooted();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
