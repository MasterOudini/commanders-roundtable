// `Compulsion` — the discard ability draws and leaves the enchantment; the
// sacrifice ability draws and takes it.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { COMPULSION_SCRIPT } from './compulsion';
import { advanceUntil, idsIn, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const COMPULSION = 'Compulsion';

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

function placed(): { g: Game; compulsion: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [[COMPULSION], []],
    scripts: createRegistry([COMPULSION_SCRIPT]),
  });
  const compulsion = put(g, 'p1', COMPULSION);
  settle(g);
  return { g, compulsion };
}

describe('Compulsion', () => {
  test('{1}{U}, discard a card: draw a card, Compulsion stays', () => {
    const { g, compulsion } = placed();
    const chosen = idsIn(g, 'p1', 'hand')[0] as InstanceId;
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'U', amount: 1 }));
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 1 }));
    const logAt = g.log.length;
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: compulsion, abilityIndex: 0, discard: [chosen], targets: [] }));
    settle(g);
    expect(g.state.cards[chosen]?.zone.kind).toBe('graveyard');
    expect(drawsFor(g, 'p1', logAt)).toBe(1);
    expect(g.state.cards[compulsion]?.zone.kind).toBe('battlefield');
  });

  test('{1}{U}, sacrifice: draw a card, Compulsion gone', () => {
    const { g, compulsion } = placed();
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'U', amount: 1 }));
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 1 }));
    const logAt = g.log.length;
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: compulsion, abilityIndex: 1, targets: [] }));
    settle(g);
    expect(drawsFor(g, 'p1', logAt)).toBe(1);
    expect(g.state.cards[compulsion]?.zone.kind).toBe('graveyard');
  });

  test('replays to the same hash', () => {
    const { g, compulsion } = placed();
    const chosen = idsIn(g, 'p1', 'hand')[0] as InstanceId;
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'U', amount: 1 }));
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 1 }));
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: compulsion, abilityIndex: 0, discard: [chosen], targets: [] }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
