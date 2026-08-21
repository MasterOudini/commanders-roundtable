// `Sunder` — every land goes home to its OWNER; creatures stay put.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { SUNDER_SCRIPT } from './sunder';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function sundered(): { g: Game; mine: InstanceId; theirs: InstanceId; bears: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [['Sunder', 'Swamp'], ['Mountain', 'Grizzly Bears']],
    scripts: createRegistry([SUNDER_SCRIPT]),
  });
  const mine = put(g, 'p1', 'Swamp');
  const theirs = put(g, 'p2', 'Mountain');
  const bears = put(g, 'p2', 'Grizzly Bears');
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const spell = put(g, 'p1', 'Sunder', 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'U', amount: 5 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  settle(g);
  return { g, mine, theirs, bears };
}

describe('Sunder', () => {
  test('both lands go to their owners; the creature stays', () => {
    const { g, mine, theirs, bears } = sundered();
    expect(g.state.cards[mine]?.zone).toEqual({ kind: 'hand', player: 'p1' });
    expect(g.state.cards[theirs]?.zone).toEqual({ kind: 'hand', player: 'p2' });
    expect(g.state.cards[bears]?.zone.kind).toBe('battlefield');
  });

  test('replays to the same hash', () => {
    const { g } = sundered();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
