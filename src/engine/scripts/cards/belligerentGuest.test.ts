// `Belligerent Guest` — connecting with a player makes a Blood token,
// through a real declared attack.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { BELLIGERENT_GUEST_SCRIPT } from './belligerentGuest';
import { advanceUntil, battlefieldOf, must, nameOf, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const GUEST = 'Belligerent Guest';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function fought(): { g: Game; guest: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [[GUEST], []],
    scripts: createRegistry([BELLIGERENT_GUEST_SCRIPT]),
  });
  const guest = put(g, 'p1', GUEST);
  settle(g);
  advanceUntil(
    g,
    (s) => s.turn.turnNumber === 3 && s.priority.awaiting?.kind === 'declareAttackers',
    20_000,
  );
  must(
    g.submit({
      t: 'DeclareAttackers',
      player: 'p1',
      attackers: [{ card: guest, defender: { kind: 'player', id: 'p2' } }],
    }),
  );
  settle(g);
  return { g, guest };
}

describe('Belligerent Guest', () => {
  test('combat damage to a player creates a Blood token', () => {
    const { g } = fought();
    expect(g.state.players['p2']?.life).toBe(37);
    expect(battlefieldOf(g, 'p1').filter((id) => nameOf(g, id) === 'Blood')).toHaveLength(1);
    expect(g.log.some((e) => e.body.t === 'TokenCreated' && e.cause.kind !== 'manual')).toBe(true);
  });

  test('replays to the same hash', () => {
    const { g } = fought();
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
