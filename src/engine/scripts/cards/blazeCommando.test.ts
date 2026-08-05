// `Blaze Commando` — a Bolt from its controller makes two Soldiers; the
// spell's type and controller are read while it is still on the stack.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { BLAZE_COMMANDO_SCRIPT } from './blazeCommando';
import { advanceUntil, battlefieldOf, must, nameOf, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

const COMMANDO = 'Blaze Commando';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function game(): Game {
  return startedGame({
    players: 2,
    decks: [[COMMANDO, 'Lightning Bolt'], []],
    scripts: createRegistry([BLAZE_COMMANDO_SCRIPT]),
  });
}

describe('Blaze Commando', () => {
  test('an instant dealing damage creates TWO Soldier tokens', () => {
    const g = game();
    put(g, 'p1', COMMANDO);
    settle(g);
    const bolt = put(g, 'p1', 'Lightning Bolt', 'hand');
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'R', amount: 1 }));
    must(g.submit({ t: 'CastSpell', player: 'p1', card: bolt, targets: [{ kind: 'player', id: 'p2' }] }));
    settle(g);
    expect(g.state.players['p2']?.life).toBe(37);
    const soldiers = battlefieldOf(g, 'p1').filter((id) => nameOf(g, id) === 'Soldier');
    expect(soldiers).toHaveLength(2);
    // ⚠️ DISTINCT ids — the first cut of `ctx.ids.nextInstance` was a pure
    // read of the unapplied state, so both tokens got ONE id: the second
    // overwrote the first and duplicated the zone entry (D164). Counting
    // alone read that corruption as a pass.
    expect(new Set(soldiers).size).toBe(2);
  });

  test('replays to the same hash', () => {
    const g = game();
    put(g, 'p1', COMMANDO);
    settle(g);
    const bolt = put(g, 'p1', 'Lightning Bolt', 'hand');
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'R', amount: 1 }));
    must(g.submit({ t: 'CastSpell', player: 'p1', card: bolt, targets: [{ kind: 'player', id: 'p2' }] }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
