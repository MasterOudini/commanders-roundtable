// `Treasure Trove` — no {T} in the cost, so it draws twice in one turn.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { TREASURE_TROVE_SCRIPT } from './treasureTrove';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const TROVE = 'Treasure Trove';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function drawn(g: Game, since: number): number {
  let n = 0;
  for (let i = since; i < g.log.length; i++) {
    const body = g.log[i]?.body;
    if (body?.t === 'DrewCards' && body.player === 'p1') n += body.cards.length;
  }
  return n;
}

function game(): { g: Game; trove: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [[TROVE], []],
    scripts: createRegistry([TREASURE_TROVE_SCRIPT]),
  });
  const trove = put(g, 'p1', TROVE);
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  return { g, trove };
}

function activate(g: Game, trove: InstanceId): number {
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'U', amount: 4 }));
  const since = g.log.length;
  must(g.submit({ t: 'ActivateAbility', player: 'p1', card: trove, abilityIndex: 0 }));
  settle(g);
  return drawn(g, since);
}

describe('Treasure Trove', () => {
  test('it draws once per activation, and twice in one turn', () => {
    const { g, trove } = game();
    expect(activate(g, trove)).toBe(1);
    expect(activate(g, trove)).toBe(1);
    expect(g.state.cards[trove]?.tapped).toBe(false);
  });

  test('replays to the same hash', () => {
    const { g, trove } = game();
    activate(g, trove);
    advanceUntil(g, (s) => s.turn.turnNumber >= 3, 120_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
