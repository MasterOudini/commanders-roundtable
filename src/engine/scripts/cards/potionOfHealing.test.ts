// `Potion of Healing` — a card on entry; white mana, the tap and the Potion
// buy 3 life.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { POTION_OF_HEALING_SCRIPT } from './potionOfHealing';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const POTION = 'Potion of Healing';

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

function placed(): { g: Game; potion: InstanceId; entryDraws: number } {
  const g = startedGame({
    players: 2,
    decks: [[POTION], []],
    scripts: createRegistry([POTION_OF_HEALING_SCRIPT]),
  });
  settle(g);
  const logAt = g.log.length;
  const potion = put(g, 'p1', POTION);
  settle(g);
  return { g, potion, entryDraws: drawsFor(g, 'p1', logAt) };
}

describe('Potion of Healing', () => {
  test('entering draws one', () => {
    const { entryDraws } = placed();
    expect(entryDraws).toBe(1);
  });

  test('{W}, {T}, sacrifice: 3 life, the Potion gone', () => {
    const { g, potion } = placed();
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'W', amount: 1 }));
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: potion, abilityIndex: 0, targets: [] }));
    settle(g);
    expect(g.state.players['p1']?.life).toBe(43);
    expect(g.state.cards[potion]?.zone.kind).toBe('graveyard');
  });

  test('replays to the same hash', () => {
    const { g, potion } = placed();
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'W', amount: 1 }));
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: potion, abilityIndex: 0, targets: [] }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
