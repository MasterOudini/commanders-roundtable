// `Grave Titan` — the entry pays two DISTINCT Zombies, and a declared attack
// pays two MORE: one printed line, both defs proven in one game.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { GRAVE_TITAN_SCRIPT } from './graveTitan';
import { advanceUntil, battlefieldOf, must, nameOf, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const TITAN = 'Grave Titan';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function zombies(g: Game): readonly InstanceId[] {
  return battlefieldOf(g, 'p1').filter((id) => nameOf(g, id) === 'Zombie');
}

function board(): { g: Game; titan: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [[TITAN], []],
    scripts: createRegistry([GRAVE_TITAN_SCRIPT]),
  });
  const titan = put(g, 'p1', TITAN);
  settle(g);
  return { g, titan };
}

describe('Grave Titan', () => {
  test('entering pays two DISTINCT Zombies; attacking pays two MORE', () => {
    const { g, titan } = board();
    expect(zombies(g)).toHaveLength(2);
    expect(new Set(zombies(g)).size).toBe(2);
    advanceUntil(
      g,
      (s) => s.turn.turnNumber === 3 && s.priority.awaiting?.kind === 'declareAttackers',
      20_000,
    );
    must(
      g.submit({
        t: 'DeclareAttackers',
        player: 'p1',
        attackers: [{ card: titan, defender: { kind: 'player', id: 'p2' } }],
      }),
    );
    settle(g);
    expect(zombies(g)).toHaveLength(4);
    expect(new Set(zombies(g)).size).toBe(4);
  });

  test('replays to the same hash', () => {
    const { g, titan } = board();
    advanceUntil(
      g,
      (s) => s.turn.turnNumber === 3 && s.priority.awaiting?.kind === 'declareAttackers',
      20_000,
    );
    must(
      g.submit({
        t: 'DeclareAttackers',
        player: 'p1',
        attackers: [{ card: titan, defender: { kind: 'player', id: 'p2' } }],
      }),
    );
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
