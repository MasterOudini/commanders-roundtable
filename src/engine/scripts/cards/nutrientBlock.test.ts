// `Nutrient Block` — eaten, it is 3 life and (through the dies watcher) a
// card; a plain death is a card alone.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { NUTRIENT_BLOCK_SCRIPT } from './nutrientBlock';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const BLOCK = 'Nutrient Block';

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

function placed(): { g: Game; block: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [[BLOCK], []],
    scripts: createRegistry([NUTRIENT_BLOCK_SCRIPT]),
  });
  const block = put(g, 'p1', BLOCK);
  settle(g);
  return { g, block };
}

describe('Nutrient Block', () => {
  test('{2}, {T}, sacrifice: 3 life and a card', () => {
    const { g, block } = placed();
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 2 }));
    const logAt = g.log.length;
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: block, abilityIndex: 0, targets: [] }));
    settle(g);
    expect(g.state.players['p1']?.life).toBe(43);
    expect(drawsFor(g, 'p1', logAt)).toBe(1);
    expect(g.state.cards[block]?.zone.kind).toBe('graveyard');
  });

  test('a plain death draws one', () => {
    const { g, block } = placed();
    const logAt = g.log.length;
    must(g.submit({ t: 'ManualMoveCard', player: 'p1', card: block, to: { kind: 'graveyard', player: 'p1' } }));
    settle(g);
    expect(drawsFor(g, 'p1', logAt)).toBe(1);
    expect(g.state.players['p1']?.life).toBe(40);
  });

  test('replays to the same hash', () => {
    const { g, block } = placed();
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 2 }));
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: block, abilityIndex: 0, targets: [] }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
