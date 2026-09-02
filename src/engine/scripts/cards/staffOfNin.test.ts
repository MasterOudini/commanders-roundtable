// `Staff of Nin` — my upkeep draws a card on top of the draw step's; the
// tap pings for 1.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { STAFF_OF_NIN_SCRIPT } from './staffOfNin';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const STAFF = 'Staff of Nin';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function drawsFor(g: Game, player: string, from: number): number {
  let n = 0;
  for (const e of g.log.slice(from)) {
    if (e.body.t !== 'CardsMoved') continue;
    n += e.body.moves.filter((m) => m.from.kind === 'library' && m.to.kind === 'hand' && m.to.player === player).length;
  }
  return n;
}

function placed(): { g: Game; staff: InstanceId; logAt: number } {
  const g = startedGame({
    players: 2,
    decks: [[STAFF], []],
    scripts: createRegistry([STAFF_OF_NIN_SCRIPT]),
  });
  const staff = put(g, 'p1', STAFF);
  settle(g);
  const logAt = g.log.length;
  return { g, staff, logAt };
}

describe('Staff of Nin', () => {
  test("my turn-3 upkeep draws one beside the draw step's one; the opponent's turn draws me nothing", () => {
    const { g, logAt } = placed();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2 && s.turn.phase === 'precombatMain', 60_000);
    expect(drawsFor(g, 'p1', logAt)).toBe(0);
    advanceUntil(g, (s) => s.turn.turnNumber >= 3 && s.turn.phase === 'precombatMain', 60_000);
    expect(drawsFor(g, 'p1', logAt)).toBe(2);
  });

  test('{T}: 1 damage to the opponent', () => {
    const { g, staff } = placed();
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: staff, abilityIndex: 0 }));
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'player', id: 'p2' }] }));
    settle(g);
    expect(g.state.players['p2']?.life).toBe(39);
    expect(g.state.cards[staff]?.tapped).toBe(true);
  });

  test('replays to the same hash', () => {
    const { g, staff } = placed();
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: staff, abilityIndex: 0 }));
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'player', id: 'p2' }] }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
