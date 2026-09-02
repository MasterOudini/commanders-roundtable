// `Pendulum of Patterns` — 3 life on entry; five mana, the tap and the
// Pendulum buy a card.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { PENDULUM_OF_PATTERNS_SCRIPT } from './pendulumOfPatterns';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const PENDULUM = 'Pendulum of Patterns';

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

function placed(): { g: Game; pendulum: InstanceId; life0: number } {
  const g = startedGame({
    players: 2,
    decks: [[PENDULUM], []],
    scripts: createRegistry([PENDULUM_OF_PATTERNS_SCRIPT]),
  });
  settle(g);
  const life0 = g.state.players['p1']?.life ?? 0;
  const pendulum = put(g, 'p1', PENDULUM);
  settle(g);
  return { g, pendulum, life0 };
}

describe('Pendulum of Patterns', () => {
  test('entering is 3 life', () => {
    const { g, life0 } = placed();
    expect(g.state.players['p1']?.life).toBe(life0 + 3);
  });

  test('{5}, {T}, sacrifice: a card, the Pendulum gone', () => {
    const { g, pendulum } = placed();
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 5 }));
    const logAt = g.log.length;
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: pendulum, abilityIndex: 0, targets: [] }));
    settle(g);
    expect(drawsFor(g, 'p1', logAt)).toBe(1);
    expect(g.state.cards[pendulum]?.zone.kind).toBe('graveyard');
  });

  test('replays to the same hash', () => {
    const { g, pendulum } = placed();
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 5 }));
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: pendulum, abilityIndex: 0, targets: [] }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
