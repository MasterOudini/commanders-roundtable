// `Anaba Shaman` — Aladdin's Ring's damage from a creature; the deep cases
// live there.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { ANABA_SHAMAN_SCRIPT } from './anabaShaman';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

const SHAMAN = 'Anaba Shaman';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

describe('Anaba Shaman', () => {
  test('pings a player for 1, taps, and replays', () => {
    const g = startedGame({
      players: 2,
      decks: [[SHAMAN], []],
      scripts: createRegistry([ANABA_SHAMAN_SCRIPT]),
    });
    const shaman = put(g, 'p1', SHAMAN);
    settle(g);
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'R', amount: 1 }));
    must(
      g.submit({
        t: 'ActivateAbility',
        player: 'p1',
        card: shaman,
        abilityIndex: 0,
        targets: [{ kind: 'player', id: 'p2' }],
      }),
    );
    settle(g);
    expect(g.state.players['p2']?.life).toBe(39);
    expect(g.state.cards[shaman]?.tapped).toBe(true);
    advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
