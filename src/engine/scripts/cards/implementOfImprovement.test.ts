// `Implement of Improvement` — the sacrifice is 2 life AND a card (the
// death watcher fires on the cost); a plain death draws one.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { IMPLEMENT_OF_IMPROVEMENT_SCRIPT } from './implementOfImprovement';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const IMPLEMENT = 'Implement of Improvement';

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

function placed(): { g: Game; implement: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [[IMPLEMENT], []],
    scripts: createRegistry([IMPLEMENT_OF_IMPROVEMENT_SCRIPT]),
  });
  const implement = put(g, 'p1', IMPLEMENT);
  settle(g);
  return { g, implement };
}

describe('Implement of Improvement', () => {
  test('{W}, sacrifice: 2 life and a card', () => {
    const { g, implement } = placed();
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'W', amount: 1 }));
    const logAt = g.log.length;
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: implement, abilityIndex: 0, targets: [] }));
    settle(g);
    expect(g.state.players['p1']?.life).toBe(42);
    expect(drawsFor(g, 'p1', logAt)).toBe(1);
    expect(g.state.cards[implement]?.zone.kind).toBe('graveyard');
  });

  test('a plain death from the battlefield draws one, no life', () => {
    const { g, implement } = placed();
    const logAt = g.log.length;
    must(g.submit({ t: 'ManualMoveCard', player: 'p1', card: implement, to: { kind: 'graveyard', player: 'p1' } }));
    settle(g);
    expect(drawsFor(g, 'p1', logAt)).toBe(1);
    expect(g.state.players['p1']?.life).toBe(40);
  });

  test('replays to the same hash', () => {
    const { g, implement } = placed();
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'W', amount: 1 }));
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: implement, abilityIndex: 0, targets: [] }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
